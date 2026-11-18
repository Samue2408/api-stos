import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { AuthOnly, CurrentUser } from '../../common/auth/decorators';
import { AccessService } from './access.service';

@Controller('me')
export class MeController {
  constructor(private readonly access: AccessService) {}

  @AuthOnly()
  @Get('access')
  async myAccess(@CurrentUser() user: AuthUser) {
    const a = await this.access.getAccess(user);
    return {
      ctx: user.ctx,
      tenantId: user.tenantId,
      permissions: a?.permissions ?? [],
      modules: a?.modules ?? [],
    };
  }
}