import { PlatformModule } from './platform.module-def';
import { UsersModule } from './users.module-def';
import { SettingsModule } from './settings.module-def';
import { CatalogModule } from './catalog.module-def';
import { SalesModule } from './sales.module-def';
import { InventoryModule } from './inventory.module-def';

export const CATALOG = [
  PlatformModule, UsersModule, SettingsModule, CatalogModule, SalesModule, InventoryModule,
] as const;

// Unión de todos los códigos de permiso, derivada del catálogo
export type PermissionCode = (typeof CATALOG)[number]['permissions'][number]['code'];
// Unión de todos los códigos de módulo
export type ModuleCode = (typeof CATALOG)[number]['code'];

/*
Cuando crees un módulo nuevo, solo agregas su archivo y una línea en CATALOG,
 y los tipos se actualizan solos.
*/