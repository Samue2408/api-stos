import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { escapeLike, WhereBuilder } from '../../common/db-utils';
import { AuditQueryDto } from './dto';
import { AuditLogEntity } from './entities/audit-log.entity';

export interface AuditEntry {
  action: string;                 // 'tenant.created', 'plan.modules_changed'
  actorId?: string | null;
  tenantId?: string | null;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLogEntity) private readonly repo: Repository<AuditLogEntity>) {}

  /** Pasa el EntityManager de la transacción para que el registro se confirme o revierta junto con el cambio. */
  async log(e: AuditEntry, tx?: EntityManager): Promise<void> {
    const repo = tx ? tx.getRepository(AuditLogEntity) : this.repo;
    await repo.insert({
      action: e.action,
      actorId: e.actorId ?? null,
      tenantId: e.tenantId ?? null,
      entityType: e.entityType ?? null,
      entityId: e.entityId ?? null,
      metadata: (e.metadata ?? {}) as any,
      ip: e.ip ?? null,
    });
  }

  async list(q: AuditQueryDto) {
    const w = new WhereBuilder();
    if (q.tenantId) w.add((p) => `a.tenant_id = ${p}`, q.tenantId);
    if (q.actorId) w.add((p) => `a.actor_id = ${p}`, q.actorId);
    if (q.action) w.add((p) => `a.action LIKE ${p}`, `${escapeLike(q.action!)}%`);
    if (q.from) w.add((p) => `a.created_at >= ${p}`, q.from);
    if (q.to) w.add((p) => `a.created_at < ${p}`, q.to);

    const [{ total }] = await this.repo.query(`SELECT count(*)::int AS total FROM audit_log a ${w.sql}`, w.params);

    const limit = w.push(q.limit);
    const offset = w.push(q.offset);
    const items = await this.repo.query(
      `SELECT a.id, a.tenant_id AS "tenantId", a.actor_id AS "actorId", u.email AS "actorEmail",
              a.action, a.entity_type AS "entityType", a.entity_id AS "entityId",
              a.metadata, a.ip, a.created_at AS "createdAt"
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
         ${w.sql}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${limit} OFFSET ${offset}`,
      w.params,
    );
    return { items, total, limit: q.limit, offset: q.offset };
  }
}