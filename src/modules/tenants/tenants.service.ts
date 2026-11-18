import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TenantMembership { tenantId: string; name: string; slug: string }

@Injectable()
export class TenantsService {
  constructor(private readonly dataSource: DataSource) {}

  listActiveMemberships(userId: string): Promise<TenantMembership[]> {
    return this.dataSource.query(
      `SELECT t.id AS "tenantId", t.name, t.slug
         FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id
        WHERE tu.user_id = $1 AND tu.status = 'active' AND t.status = 'active'
        ORDER BY t.name`,
      [userId],
    );
  }

  async hasActiveMembership(userId: string, tenantId: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM tenant_users tu JOIN tenants t ON t.id = tu.tenant_id
        WHERE tu.user_id = $1 AND tu.tenant_id = $2
          AND tu.status = 'active' AND t.status = 'active'`,
      [userId, tenantId],
    );
    return rows.length > 0;
  }
}