import { PlatformModule } from './platform.module-def';
import { UsersModule } from './users.module-def';
import { SettingsModule } from './settings.module-def';
import { CatalogModule } from './catalog.module-def';
import { SalesModule } from './sales.module-def';
import { InventoryModule } from './inventory.module-def';
import { AnyModuleDef } from '../define-module';

export const CATALOG = [
  PlatformModule, UsersModule, SettingsModule, CatalogModule, SalesModule, InventoryModule,
] as const;

// Unión de todos los códigos de permiso, derivada del catálogo
export type PermissionCode = (typeof CATALOG)[number]['permissions'][number]['code'];
// Unión de todos los códigos de módulo
export type ModuleCode = (typeof CATALOG)[number]['code'];

/** Módulos que pueden incluirse en un plan: de tenant y con permiso :access. */
export const PLAN_ASSIGNABLE_MODULE_CODES: readonly string[] = (CATALOG as readonly AnyModuleDef[])
  .filter((m) => m.scope === 'tenant' && m.permissions.some((p) => p.type === 'module_access'))
  .map((m) => m.code);

/*
Cuando crees un módulo nuevo, solo agregas su archivo y una línea en CATALOG,
 y los tipos se actualizan solos.
*/