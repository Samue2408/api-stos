import { defineModule } from '../define-module';

export const UsersModule = defineModule({
  code: 'users',
  name: 'Usuarios',
  scope: 'tenant',            // núcleo: sin permiso :access
  permissions: [
    { code: 'users:read',        type: 'action', name: 'Ver usuarios' },
    { code: 'users:create',      type: 'action', name: 'Invitar usuarios' },
    { code: 'users:update',      type: 'action', name: 'Editar usuarios' },
    { code: 'users:assign-role', type: 'action', name: 'Asignar roles a usuarios' },
  ],
});