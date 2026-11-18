import { SetMetadata } from '@nestjs/common';
import { ModuleCode, PermissionCode } from './catalog';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const MODULES_KEY = 'requiredModules';

/** Requiere TODOS los permisos listados. */
export const RequirePermissions = (...codes: PermissionCode[]) => SetMetadata(PERMISSIONS_KEY, codes);

/** Requiere que el plan del tenant incluya AL MENOS UNO de los módulos (any-of). */
export const RequireModule = (...codes: ModuleCode[]) => SetMetadata(MODULES_KEY, codes);

// Si escribes @RequirePermissions('invoicez:read'), no compila.