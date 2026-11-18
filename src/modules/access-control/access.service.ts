import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthUser } from '../../common/auth/auth-user';

export interface EffectiveAccess {
  permissions: string[]; // rol ∩ plan (los :access solo si el plan incluye el módulo)
  modules: string[];     // códigos de módulos incluidos en el plan del tenant
}

// Permisos efectivos con caché
@Injectable()
export class AccessService {
  private readonly cache = new Map<string, { value: EffectiveAccess | null; expiresAt: number }>();
  private readonly TTL_MS = 60_000;

  constructor(private readonly dataSource: DataSource) {}

  async getAccess(user: AuthUser): Promise<EffectiveAccess | null> {
    if (user.ctx === 'none') return null;

    const key = `${user.userId}|${user.ctx}|${user.tenantId ?? ''}`;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value =
      user.ctx === 'platform'
        ? await this.loadPlatform(user.userId)
        : await this.loadTenant(user.userId, user.tenantId!);

    if (this.cache.size > 10_000) this.cache.clear(); // tope simple; con Redis ya no hace falta
    this.cache.set(key, { value, expiresAt: Date.now() + this.TTL_MS });
    return value;
  }

  // ---- Invalidación: llamar cuando cambie un rol, un plan, un estado, etc. ----
  invalidateUser(userId: string) {
    for (const k of this.cache.keys()) if (k.startsWith(`${userId}|`)) this.cache.delete(k);
  }
  invalidateTenant(tenantId: string) {
    for (const k of this.cache.keys()) if (k.endsWith(`|${tenantId}`)) this.cache.delete(k);
  }
  invalidateAll() {
    this.cache.clear();
  }

  // ---- Consultas ----
  private async loadTenant(userId: string, tenantId: string): Promise<EffectiveAccess | null> {
    const [membership] = await this.dataSource.query(
      `SELECT t.plan_id AS "planId", tu.role_id AS "roleId"
         FROM tenant_users tu
         JOIN users u   ON u.id = tu.user_id AND u.status = 'active'
         JOIN tenants t ON t.id = tu.tenant_id AND t.status = 'active'
         JOIN roles r   ON r.id = tu.role_id AND r.is_active
        WHERE tu.user_id = $1 AND tu.tenant_id = $2 AND tu.status = 'active'`,
      [userId, tenantId],
    );
    if (!membership) return null;

    const [modules, permissions] = await Promise.all([
      this.dataSource.query(
        `SELECT m.code
           FROM plan_modules pm JOIN modules m ON m.id = pm.module_id AND m.is_active
          WHERE pm.plan_id = $1`,
        [membership.planId],
      ),
      this.dataSource.query(
        `SELECT DISTINCT p.code
           FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id AND p.is_active AND p.scope = 'tenant'
          WHERE rp.role_id = $1
            AND (
              p.type = 'action'
              OR EXISTS (SELECT 1 FROM plan_modules pm
                          WHERE pm.plan_id = $2 AND pm.module_id = p.module_id)
            )`,
        [membership.roleId, membership.planId],
      ),
    ]);

    return {
      permissions: permissions.map((r: { code: string }) => r.code),
      modules: modules.map((r: { code: string }) => r.code),
    };
  }

  private async loadPlatform(userId: string): Promise<EffectiveAccess | null> {
    const rows = await this.dataSource.query(
      `SELECT DISTINCT p.code
         FROM platform_admins pa
         JOIN users u ON u.id = pa.user_id AND u.status = 'active'
         JOIN roles r ON r.id = pa.role_id AND r.is_active
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id AND p.is_active AND p.scope = 'platform'
        WHERE pa.user_id = $1`,
      [userId],
    );
    if (!rows.length) return null;
    return { permissions: rows.map((r: { code: string }) => r.code), modules: [] };
  }
}