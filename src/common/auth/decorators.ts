import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from './auth-user';

export const IS_PUBLIC = 'isPublic';
export const AUTH_ONLY = 'authOnly';
export const ALLOW_PENDING_PASSWORD_CHANGE = 'allowPendingPasswordChange';

/** Sin autenticación (login, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Solo requiere sesión válida, sin permisos (p. ej. /me/access, cambio de contexto). */
export const AuthOnly = () => SetMetadata(AUTH_ONLY, true);
/** Permite el endpoint aunque el usuario deba cambiar su contraseña (cambiarla, cerrar sesión). */
export const AllowPendingPasswordChange = () => SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);