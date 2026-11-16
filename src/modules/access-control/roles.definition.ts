import { PermissionCode } from './catalog';
import { ScopeType } from './define-module';

export interface RoleDef {
  readonly code: string;
  readonly name: string;
  readonly scope: ScopeType;
  readonly description?: string;
  /** '*' = todos los permisos activos de su mismo scope */
  readonly permissions: '*' | readonly PermissionCode[];
}

export const ROLES = [
  // Plataforma
  { code: 'super_admin', name: 'Super administrador', scope: 'platform', permissions: '*' },
  {
    code: 'platform_support', name: 'Soporte de plataforma', scope: 'platform',
    permissions: ['platform:access', 'tenants:read', 'plans:read'],
  },
  // Tenant
  { code: 'tenant_admin', name: 'Administrador', scope: 'tenant', permissions: '*' },
  {
    code: 'seller', name: 'Vendedor', scope: 'tenant',
    permissions: ['sales:access', 'products:read', 'invoices:read', 'invoices:create'],
  },
  {
    code: 'warehouse', name: 'Bodeguero', scope: 'tenant',
    permissions: ['inventory:access', 'products:read', 'stock:read', 'stock:update'],
  },
] as const satisfies readonly RoleDef[];

/*
Con '*', cuando agregues un módulo nuevo el tenant_admin 
recibe sus permisos automáticamente. Sigue dependiendo del 
plan para ver el módulo.
*/