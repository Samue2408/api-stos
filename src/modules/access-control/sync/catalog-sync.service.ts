import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, In, Not } from 'typeorm';
import { CATALOG } from '../catalog';
import { AnyModuleDef, ScopeType } from '../define-module';
import { ROLES, RoleDef } from '../roles.definition';
import { ModuleEntity } from '../entities/module.entity';
import { PermissionEntity } from '../entities/permission.entity';
import { RoleEntity } from '../entities/role.entity';
import { RolePermissionEntity } from '../entities/role-permission.entity';
import { assertCatalogIsValid } from './catalog-validator';

const SYNC_LOCK_KEY = 727_001; // evita syncs simultáneos si hay varias instancias

type PermissionInfo = { id: string; scope: ScopeType };

@Injectable()
export class CatalogSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    assertCatalogIsValid(); // falla antes de tocar la BD

    await this.dataSource.transaction(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)', [SYNC_LOCK_KEY]);

      const moduleIds = await this.syncModules(tx);
      const permissions = await this.syncPermissions(tx, moduleIds);
      const roleIds = await this.syncRoles(tx);
      await this.syncRolePermissions(tx, roleIds, permissions);
    });

    this.logger.log('Catálogo de acceso sincronizado');
  }

  private async syncModules(tx: EntityManager): Promise<Map<string, string>> {
    const defs = CATALOG as readonly AnyModuleDef[];

    await tx.upsert(
      ModuleEntity,
      defs.map((m) => ({
        code: m.code,
        name: m.name,
        description: m.description ?? null,
        isActive: true,
      })),
      ['code'],
    );

    // Marca como inactivo lo que ya no está en el código (nunca se borra)
    await tx.update(
      ModuleEntity,
      { code: Not(In(defs.map((m) => m.code))), isActive: true },
      { isActive: false },
    );

    // Segunda pasada: el padre puede estar definido después del hijo
    const rows = await tx.find(ModuleEntity);
    const ids = new Map(rows.map((r) => [r.code, r.id]));
    for (const m of defs) {
      const parentId = m.parent ? (ids.get(m.parent) ?? null) : null;
      const current = rows.find((r) => r.code === m.code)!;
      if (current.parentId !== parentId) {
        await tx.update(ModuleEntity, { code: m.code }, { parentId });
      }
    }
    return ids;
  }

  private async syncPermissions(
    tx: EntityManager,
    moduleIds: Map<string, string>,
  ): Promise<Map<string, PermissionInfo>> {
    const defs = CATALOG as readonly AnyModuleDef[];
    const rows = defs.flatMap((m) =>
      m.permissions.map((p) => ({
        code: p.code,
        moduleId: moduleIds.get(m.code)!,
        name: p.name,
        description: p.description ?? null,
        type: p.type,
        scope: m.scope,
        isActive: true,
      })),
    );

    await tx.upsert(PermissionEntity, rows, ['code']);
    await tx.update(
      PermissionEntity,
      { code: Not(In(rows.map((r) => r.code))), isActive: true },
      { isActive: false },
    );

    const saved = await tx.find(PermissionEntity, { where: { isActive: true } });
    return new Map(saved.map((p) => [p.code, { id: p.id, scope: p.scope }]));
  }

  private async syncRoles(tx: EntityManager): Promise<Map<string, string>> {
    const defs = ROLES as readonly RoleDef[];

    await tx.upsert(
      RoleEntity,
      defs.map((r) => ({
        code: r.code,
        name: r.name,
        scope: r.scope,
        description: r.description ?? null,
        isActive: true,
      })),
      ['code'],
    );
    await tx.update(
      RoleEntity,
      { code: Not(In(defs.map((r) => r.code))), isActive: true },
      { isActive: false },
    );

    const saved = await tx.find(RoleEntity);
    return new Map(saved.map((r) => [r.code, r.id]));
  }

  /** El código manda: se reconstruye completo en cada sync. */
  private async syncRolePermissions(
    tx: EntityManager,
    roleIds: Map<string, string>,
    permissions: Map<string, PermissionInfo>,
  ): Promise<void> {
    for (const role of ROLES as readonly RoleDef[]) {
      const roleId = roleIds.get(role.code)!;

      const permissionIds =
        role.permissions === '*'
          ? [...permissions.values()].filter((p) => p.scope === role.scope).map((p) => p.id)
          : role.permissions.map((code) => permissions.get(code)!.id);

      await tx.delete(RolePermissionEntity, { roleId });
      if (permissionIds.length) {
        await tx.insert(
          RolePermissionEntity,
          permissionIds.map((permissionId) => ({ roleId, permissionId })),
        );
      }
    }
  }
}