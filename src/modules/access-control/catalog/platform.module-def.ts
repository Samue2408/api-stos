import { defineModule } from '../define-module';

export const PlatformModule = defineModule({
  code: 'platform',
  name: 'Plataforma',
  scope: 'platform',          // nunca va en plan_modules
  permissions: [
    { code: 'platform:access',        type: 'module_access', name: 'Acceder al panel de plataforma' },
    { code: 'tenants:read',            type: 'action', name: 'Ver tenants' },
    { code: 'tenants:manage',          type: 'action', name: 'Crear y editar tenants' },
    { code: 'plans:read',              type: 'action', name: 'Ver planes' },
    { code: 'plans:manage',            type: 'action', name: 'Gestionar planes y sus módulos' },
    { code: 'platform-admins:manage',  type: 'action', name: 'Gestionar administradores de plataforma' },
  ],
});