// plans/plans.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AuthUser } from '../../common/auth/auth-user';
import { isUniqueViolation } from '../../common/db-utils';
import { AccessService } from '../access-control/access.service';
import { PLAN_ASSIGNABLE_MODULE_CODES } from '../access-control/catalog';
import { AuditService } from '../audit/audit.service';
import { CreatePlanDto, PlanModuleItemDto, SetPlanModulesDto, UpdatePlanDto } from './dto';
import { PlanEntity } from './entities/plan.entity';
import { PlanModuleEntity } from './entities/plan-module.entity';

interface ResolvedModule { id: string; code: string; configuration: Record<string, unknown> }
type PlanFields = { name: string; maxUsers: number; maxProjects: number; storageLimitBytes: number };

@Injectable()
export class PlansService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // ---------- lectura ----------

  list() {
    return this.select();
  }

  async get(id: string) {
    const [plan] = await this.select(id);
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  /** Módulos que el panel puede ofrecer al armar un plan. */
  listAssignableModules() {
    return this.dataSource.query(
      `SELECT code, name, description FROM modules
        WHERE is_active AND code = ANY($1) ORDER BY name`,
      [[...PLAN_ASSIGNABLE_MODULE_CODES]],
    );
  }

  // ---------- escritura ----------

  async create(dto: CreatePlanDto, actor: AuthUser, ip: string | null) {
    const modules = await this.resolveModules(dto.modules ?? []);
    try {
      const id = await this.dataSource.transaction(async (tx) => {
        const plan = await tx.save(
          PlanEntity,
          tx.create(PlanEntity, {
            code: dto.code,
            name: dto.name,
            maxUsers: dto.maxUsers,
            maxProjects: dto.maxProjects,
            storageLimitBytes: String(dto.storageLimitBytes),
          }),
        );
        await this.insertModules(tx, plan.id, modules);
        await this.audit.log({
          action: 'plan.created', actorId: actor.userId, entityType: 'plan', entityId: plan.id, ip,
          metadata: { code: dto.code, modules: modules.map((m) => m.code) },
        }, tx);
        return plan.id;
      });
      return this.get(id);
    } catch (e) {
      if (isUniqueViolation(e, 'code')) throw new ConflictException('Ya existe un plan con ese code');
      throw e;
    }
  }

  async update(id: string, dto: UpdatePlanDto, actor: AuthUser, ip: string | null) {
    await this.dataSource.transaction(async (tx) => {
      const plan = await this.lockPlan(tx, id);
      const current: PlanFields = {
        name: plan.name, maxUsers: plan.maxUsers, maxProjects: plan.maxProjects,
        storageLimitBytes: Number(plan.storageLimitBytes),
      };
      const next: PlanFields = {
        name: dto.name ?? current.name,
        maxUsers: dto.maxUsers ?? current.maxUsers,
        maxProjects: dto.maxProjects ?? current.maxProjects,
        storageLimitBytes: dto.storageLimitBytes ?? current.storageLimitBytes,
      };

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of Object.keys(next) as (keyof PlanFields)[]) {
        if (next[k] !== current[k]) changes[k] = { from: current[k], to: next[k] };
      }
      if (!Object.keys(changes).length) return;

      if (next.maxUsers < current.maxUsers) await this.assertNoTenantExceeds(tx, id, next.maxUsers);

      await tx.update(PlanEntity, { id }, { ...next, storageLimitBytes: String(next.storageLimitBytes) });
      await this.audit.log(
        { action: 'plan.updated', actorId: actor.userId, entityType: 'plan', entityId: id, ip, metadata: { changes } },
        tx,
      );
    });
    return this.get(id);
  }

  async setModules(id: string, dto: SetPlanModulesDto, actor: AuthUser, ip: string | null) {
    const resolved = await this.resolveModules(dto.modules);

    await this.dataSource.transaction(async (tx) => {
      await this.lockPlan(tx, id);

      const before: { code: string }[] = await tx.query(
        `SELECT m.code FROM plan_modules pm JOIN modules m ON m.id = pm.module_id WHERE pm.plan_id = $1`,
        [id],
      );
      const beforeCodes = before.map((r) => r.code);
      const afterCodes = resolved.map((m) => m.code);
      const removed = beforeCodes.filter((c) => !afterCodes.includes(c));
      const added = afterCodes.filter((c) => !beforeCodes.includes(c));

      if (removed.length) {
        const [{ count }] = await tx.query(
          `SELECT count(*)::int AS count FROM tenants WHERE plan_id = $1 AND status <> 'cancelled'`,
          [id],
        );
        if (count > 0 && !dto.confirmRemoval) {
          throw new ConflictException({
            message: `Quitar ${removed.join(', ')} afecta a ${count} tenant(s) de inmediato. Reenvía con confirmRemoval: true.`,
            removed,
            affectedTenants: count,
          });
        }
      }

      await tx.query(`DELETE FROM plan_modules WHERE plan_id = $1`, [id]);
      await this.insertModules(tx, id, resolved);
      await this.audit.log(
        { action: 'plan.modules_changed', actorId: actor.userId, entityType: 'plan', entityId: id, ip, metadata: { added, removed } },
        tx,
      );
    });

    this.access.invalidateAll(); // afecta a todos los tenants de este plan; ya hizo commit
    return this.get(id);
  }

  async setActive(id: string, active: boolean, actor: AuthUser, ip: string | null) {
    await this.dataSource.transaction(async (tx) => {
      const plan = await this.lockPlan(tx, id);
      if (plan.isActive === active) return;

      if (!active) {
        const [{ count }] = await tx.query(
          `SELECT count(*)::int AS count FROM tenants WHERE plan_id = $1 AND status <> 'cancelled'`,
          [id],
        );
        if (count > 0) {
          throw new ConflictException(`El plan tiene ${count} tenant(s). Cámbialos de plan antes de desactivarlo.`);
        }
      }
      await tx.update(PlanEntity, { id }, { isActive: active });
      await this.audit.log(
        { action: active ? 'plan.activated' : 'plan.deactivated', actorId: actor.userId, entityType: 'plan', entityId: id, ip },
        tx,
      );
    });
    return this.get(id);
  }

  // ---------- internos ----------

  private async select(id?: string) {
    const rows = await this.dataSource.query(
      `SELECT p.id, p.code, p.name,
              p.max_users AS "maxUsers", p.max_projects AS "maxProjects",
              p.storage_limit_bytes AS "storageLimitBytes",
              p.is_active AS "isActive", p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              COALESCE((SELECT json_agg(json_build_object('code', m.code, 'name', m.name,
                                                          'configuration', pm.configuration) ORDER BY m.code)
                          FROM plan_modules pm JOIN modules m ON m.id = pm.module_id
                         WHERE pm.plan_id = p.id), '[]'::json) AS modules,
              (SELECT count(*)::int FROM tenants t
                WHERE t.plan_id = p.id AND t.status <> 'cancelled') AS "tenantsCount"
         FROM plans p
         ${id ? 'WHERE p.id = $1' : ''}
        ORDER BY p.name`,
      id ? [id] : [],
    );
    return rows.map((r: { storageLimitBytes: string }) => ({ ...r, storageLimitBytes: Number(r.storageLimitBytes) }));
  }

  /** Bloquea la fila del plan para serializar cambios concurrentes. */
  private async lockPlan(tx: EntityManager, id: string) {
    const [plan] = await tx.query(
      `SELECT id, name, max_users AS "maxUsers", max_projects AS "maxProjects",
              storage_limit_bytes AS "storageLimitBytes", is_active AS "isActive"
         FROM plans WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!plan) throw new NotFoundException('Plan no encontrado');
    return plan;
  }

  private async resolveModules(items: PlanModuleItemDto[]): Promise<ResolvedModule[]> {
    if (!items.length) return [];
    const codes = items.map((i) => i.code);

    const invalid = codes.filter((c) => !PLAN_ASSIGNABLE_MODULE_CODES.includes(c));
    if (invalid.length) {
      throw new BadRequestException(`Módulos no asignables a un plan: ${invalid.join(', ')}`);
    }

    const rows: { id: string; code: string }[] = await this.dataSource.query(
      `SELECT id, code FROM modules WHERE code = ANY($1) AND is_active`,
      [codes],
    );
    const byCode = new Map(rows.map((r) => [r.code, r.id]));
    const missing = codes.filter((c) => !byCode.has(c));
    if (missing.length) throw new BadRequestException(`Módulos inexistentes o inactivos: ${missing.join(', ')}`);

    return items.map((i) => ({ id: byCode.get(i.code)!, code: i.code, configuration: i.configuration ?? {} }));
  }

  private async insertModules(tx: EntityManager, planId: string, modules: ResolvedModule[]) {
    if (!modules.length) return;
    await tx.insert(
      PlanModuleEntity,
      modules.map((m) => ({
        planId,
        moduleId: m.id,
        configuration: m.configuration as any,
      })),
    );
  }

  private async assertNoTenantExceeds(tx: EntityManager, planId: string, maxUsers: number) {
    const rows: { name: string; users: number }[] = await tx.query(
      `SELECT t.name, count(*)::int AS users
         FROM tenants t JOIN tenant_users tu ON tu.tenant_id = t.id AND tu.status = 'active'
        WHERE t.plan_id = $1 AND t.status <> 'cancelled'
        GROUP BY t.id, t.name HAVING count(*) > $2`,
      [planId, maxUsers],
    );
    if (rows.length) {
      const list = rows.map((r) => `${r.name} (${r.users})`).join(', ');
      throw new ConflictException(`Hay tenants con más usuarios activos que el nuevo límite: ${list}`);
    }
  }
}