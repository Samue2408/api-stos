import { defineModule } from '../define-module';

export const SettingsModule = defineModule({
  code: 'settings',
  name: 'Configuración',
  scope: 'tenant',            // núcleo
  permissions: [
    { code: 'settings:read',   type: 'action', name: 'Ver configuración del tenant' },
    { code: 'settings:update', type: 'action', name: 'Editar configuración del tenant' },
  ],
});