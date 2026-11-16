import { defineModule } from '../define-module';

export const CatalogModule = defineModule({
  code: 'catalog',
  name: 'Catálogo de productos',
  scope: 'tenant',            // contenedor de permisos compartidos
  permissions: [
    { code: 'products:read',   type: 'action', name: 'Ver productos' },
    { code: 'products:create', type: 'action', name: 'Crear productos' },
    { code: 'products:update', type: 'action', name: 'Editar productos' },
  ],
});