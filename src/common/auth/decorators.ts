import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AuthUser } from './auth-user';

export const IS_PUBLIC = 'isPublic';
export const AUTH_ONLY = 'authOnly';

/** Sin autenticación (login, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Solo requiere sesión válida, sin permisos (p. ej. /me/access, cambio de contexto). */
export const AuthOnly = () => SetMetadata(AUTH_ONLY, true);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);