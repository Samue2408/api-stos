import { defineModule } from '../define-module';

export const SalesModule = defineModule({
  code: 'sales',
  name: 'Ventas',
  scope: 'tenant',
  permissions: [
    { code: 'sales:access', type: 'module_access', name: 'Acceder a Ventas' },
    { code: 'invoices:read', type: 'action', name: 'Ver facturas' },
    { code: 'invoices:create', type: 'action', name: 'Crear facturas' },
    { code: 'invoices:cancel', type: 'action', name: 'Anular facturas' },
    { code: 'invoices:export', type: 'action', name: ' Exportar reporte' },
  ],
});
