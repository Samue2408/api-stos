import { defineModule } from '../define-module';

export const InventoryModule = defineModule({
  code: 'inventory',
  name: 'Inventario',
  scope: 'tenant',
  permissions: [
    { code: 'inventory:access', type: 'module_access', name: 'Acceder a Inventario' },
    { code: 'stock:read',       type: 'action', name: 'Ver stock' },
    { code: 'stock:update',     type: 'action', name: 'Ajustar stock' },
  ],
});