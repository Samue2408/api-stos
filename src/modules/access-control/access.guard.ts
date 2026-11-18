import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser } from '../../common/auth/auth-user';
import { AUTH_ONLY, IS_PUBLIC } from '../../common/auth/decorators';
import { AccessService } from './access.service';
import { MODULES_KEY, PERMISSIONS_KEY } from './decorators';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: AccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const get = <T>(key: string) => this.reflector.getAllAndOverride<T | undefined>(key, targets);

    if (get<boolean>(IS_PUBLIC)) return true;

    const req = ctx.switchToHttp().getRequest();
    const user: AuthUser | undefined = req.user;
    if (!user) throw new UnauthorizedException();

    const permissions = get<string[]>(PERMISSIONS_KEY);
    const modules = get<string[]>(MODULES_KEY);

    if (!permissions && !modules) {
      // Solo se permite sin política si se declaró explícitamente @AuthOnly()
      if (get<boolean>(AUTH_ONLY)) return true;
      throw new ForbiddenException('Endpoint sin política de acceso');
    }

    if (user.ctx === 'none') throw new ForbiddenException('Debes seleccionar un contexto');

    const access = await this.access.getAccess(user);
    if (!access) throw new ForbiddenException('Sin acceso vigente en este contexto');

    if (modules?.length && !modules.some((m) => access.modules.includes(m))) {
      throw new ForbiddenException('Módulo no incluido en el plan');
    }
    if (permissions?.length && !permissions.every((p) => access.permissions.includes(p))) {
      throw new ForbiddenException('Permisos insuficientes');
    }

    req.access = access;
    return true;
  }
}