import {
  BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/auth/auth-user';
import { escapeLike, isUniqueViolation, WhereBuilder } from '../../common/db-utils';
import { AccessService } from '../access-control/access.service';
import { AuditService } from '../audit/audit.service';
import { RESERVED_SLUGS, STATUS_TRANSITIONS, TenantStatus } from './constants';
import { CreateTenantDto, ListTenantsDto } from './dto';

const STATUS_ACTIONS: Record<TenantStatus, string> = {
  suspended: 'tenant.suspended',
  active: 'tenant.reactivated',
  cancelled: 'tenant.cancelled',
};

@Injectable()
export class TenantsAdminService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: AccessService,
    private readonly audit: AuditService,
  ) {}

  // ---------- lectura ----------

  async list(q: ListTenantsDto) {
    const w = new WhereBuilder();
    if (q.status) w.add((p) => `t.status = ${p}`, q.status);
    if (q.planId) w.add((p) => `t.plan_id = ${p}`, q.planId);
    if (q.search) {
      w.add((p) => `(t.name ILIKE ${p} OR t.slug ILIKE ${p})`, `%${escapeLike(q.search!)}%`);
    }

    const [{ total }] = await this.dataSource.query(
      `SELECT count(*)::int AS total FROM tenants t ${w.sql}`, w.params,
    );

    const limit = w.push(q.limit);
    const offset = w.push(q.offset);
    const items = await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.status, t.created_at AS "createdAt",
              p.id AS "planId", p.name AS "planName",
              (SELECT count(*)::int FROM tenant_users tu
                WHERE tu.tenant_id = t.id AND tu.status = 'active') AS "activeUsers"
         FROM tenants t JOIN plans p ON p.id = t.plan_id
         ${w.sql}
        ORDER BY t.created_at DESC, t.id
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    return { items, total, limit: q.limit, offset: q.offset };
  }

  async get(id: string) {
    const [tenant] = await this.dataSource.query(
      `SELECT t.id, t.name, t.slug, t.status, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
              p.id AS "planId", p.code AS "planCode", p.name AS "planName", p.max_users AS "maxUsers",
              (SELECT count(*)::int FROM tenant_users tu
                WHERE tu.tenant_id = t.id AND tu.status = 'active') AS "activeUsers"
         FROM tenants t JOIN plans p ON p.id = t.plan_id
        WHERE t.id = $1`,
      [id],
    );
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const [modules, admins] = await Promise.all([
      this.dataSource.query(
        `SELECT m.code FROM plan_modules pm JOIN modules m ON m.id = pm.module_id
          WHERE pm.plan_id = $1 ORDER BY m.code`,
        [tenant.planId],
      ),
      this.dataSource.query(
        `SELECT u.id AS "userId", u.email, u.first_name AS "firstName", u.last_name AS "lastName",
                tu.status
           FROM tenant_users tu
           JOIN users u ON u.id = tu.user_id
           JOIN roles r ON r.id = tu.role_id
          WHERE tu.tenant_id = $1 AND r.code = 'tenant_admin'
          ORDER BY u.email`,
        [id],
      ),
    ]);
    return { ...tenant, modules: modules.map((m: { code: string }) => m.code), admins };
  }

  // ---------- escritura ----------

  async create(dto: CreateTenantDto, actor: AuthUser, ip: string | null) {
    if (RESERVED_SLUGS.has(dto.slug)) throw new BadRequestException('Ese slug está reservado');

    try {
      const result = await this.dataSource.transaction(async (tx) => {
        const [plan] = await tx.query(`SELECT is_active AS "isActive" FROM plans WHERE id = $1`, [dto.planId]);
        if (!plan || !plan.isActive) throw new BadRequestException('Plan inexistente o inactivo');

        const [role] = await tx.query(`SELECT id FROM roles WHERE code = 'tenant_admin' AND is_active`);
        if (!role) throw new InternalServerErrorException('El rol tenant_admin no está sincronizado');

        const [tenant] = await tx.query(
          `INSERT INTO tenants (name, slug, plan_id) VALUES ($1, $2, $3) RETURNING id`,
          [dto.name.trim(), dto.slug, dto.planId],
        );
        await tx.query(`INSERT INTO tenant_settings (tenant_id) VALUES ($1)`, [tenant.id]);

        // Administrador inicial: usuario existente o nuevo con contraseña temporal
        const email = dto.admin.email.trim();
        const [existing] = await tx.query(`SELECT id, status FROM users WHERE email = $1`, [email]);

        let userId: string;
        let temporaryPassword: string | undefined;
        if (existing) {
          if (existing.status !== 'active') {
            throw new ConflictException('El usuario existe pero no está activo');
          }
          userId = existing.id; // no se toca su contraseña
        } else {
          temporaryPassword = randomBytes(12).toString('base64url');
          const [user] = await tx.query(
            `INSERT INTO users (email, password_hash, first_name, last_name, must_change_password)
             VALUES ($1, $2, $3, $4, true) RETURNING id`,
            [email, await argon2.hash(temporaryPassword), dto.admin.firstName.trim(), dto.admin.lastName.trim()],
          );
          userId = user.id;
        }

        await tx.query(
          `INSERT INTO tenant_users (tenant_id, user_id, role_id, status) VALUES ($1, $2, $3, 'active')`,
          [tenant.id, userId, role.id],
        );

        await this.audit.log({
          action: 'tenant.created', actorId: actor.userId, tenantId: tenant.id,
          entityType: 'tenant', entityId: tenant.id, ip,
          // Nunca se registra la contraseña temporal
          metadata: { slug: dto.slug, planId: dto.planId, adminUserId: userId, adminCreated: !existing },
        }, tx);

        return { tenantId: tenant.id as string, userId, email, created: !existing, temporaryPassword };
      });

      const tenant = await this.get(result.tenantId);
      return {
        tenant,
        admin: {
          userId: result.userId,
          email: result.email,
          created: result.created,
          // Solo aparece aquí, una vez. Medida temporal hasta tener invitaciones por correo.
          ...(result.temporaryPassword ? { temporaryPassword: result.temporaryPassword } : {}),
        },
      };
    } catch (e) {
      if (isUniqueViolation(e, 'slug')) throw new ConflictException('Ese slug ya está en uso');
      if (isUniqueViolation(e, 'email')) throw new ConflictException('El email se registró en paralelo; reintenta');
      throw e;
    }
  }

  async rename(id: string, name: string, actor: AuthUser, ip: string | null) {
    await this.dataSource.transaction(async (tx) => {
      const [t] = await tx.query(`SELECT name FROM tenants WHERE id = $1 FOR UPDATE`, [id]);
      if (!t) throw new NotFoundException('Tenant no encontrado');
      const next = name.trim();
      if (t.name === next) return;

      await tx.query(`UPDATE tenants SET name = $1, updated_at = now() WHERE id = $2`, [next, id]);
      await this.audit.log({
        action: 'tenant.updated', actorId: actor.userId, tenantId: id, entityType: 'tenant', entityId: id, ip,
        metadata: { changes: { name: { from: t.name, to: next } } },
      }, tx);
    });
    return this.get(id);
  }

  async changeStatus(id: string, target: TenantStatus, reason: string | undefined, actor: AuthUser, ip: string | null) {
    await this.dataSource.transaction(async (tx) => {
      const [t] = await tx.query(`SELECT status FROM tenants WHERE id = $1 FOR UPDATE`, [id]);
      if (!t) throw new NotFoundException('Tenant no encontrado');

      if (!STATUS_TRANSITIONS[t.status as TenantStatus].includes(target)) {
        throw new ConflictException(`No se puede pasar de ${t.status} a ${target}`);
      }
      await tx.query(`UPDATE tenants SET status = $1, updated_at = now() WHERE id = $2`, [target, id]);
      await this.audit.log({
        action: STATUS_ACTIONS[target], actorId: actor.userId, tenantId: id,
        entityType: 'tenant', entityId: id, ip,
        metadata: { from: t.status, to: target, reason: reason ?? null },
      }, tx);
    });

    // Tras el commit: el acceso se corta de inmediato. El refresh también falla,
    // porque hasActiveMembership exige tenant activo.
    this.access.invalidateTenant(id);
    return this.get(id);
  }

  async changePlan(id: string, planId: string, actor: AuthUser, ip: string | null) {
    await this.dataSource.transaction(async (tx) => {
      const [t] = await tx.query(`SELECT plan_id AS "planId", status FROM tenants WHERE id = $1 FOR UPDATE`, [id]);
      if (!t) throw new NotFoundException('Tenant no encontrado');
      if (t.status === 'cancelled') throw new ConflictException('El tenant está cancelado');
      if (t.planId === planId) throw new BadRequestException('El tenant ya tiene ese plan');

      const [plan] = await tx.query(
        `SELECT is_active AS "isActive", max_users AS "maxUsers" FROM plans WHERE id = $1`, [planId],
      );
      if (!plan || !plan.isActive) throw new BadRequestException('Plan inexistente o inactivo');

      const [{ users }] = await tx.query(
        `SELECT count(*)::int AS users FROM tenant_users WHERE tenant_id = $1 AND status = 'active'`, [id],
      );
      if (users > plan.maxUsers) {
        throw new ConflictException(
          `El tenant tiene ${users} usuarios activos y el plan permite ${plan.maxUsers}. Desactiva usuarios primero.`,
        );
      }

      await tx.query(`UPDATE tenants SET plan_id = $1, updated_at = now() WHERE id = $2`, [planId, id]);
      await this.audit.log({
        action: 'tenant.plan_changed', actorId: actor.userId, tenantId: id,
        entityType: 'tenant', entityId: id, ip, metadata: { from: t.planId, to: planId },
      }, tx);
    });

    this.access.invalidateTenant(id);
    return this.get(id);
  }
}