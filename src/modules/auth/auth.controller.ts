import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth/auth-user';
import { AuthOnly, CurrentUser, Public } from '../../common/auth/decorators';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, SelectContextDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @AuthOnly()
  @HttpCode(200)
  @Post('select-context')
  selectContext(@CurrentUser() user: AuthUser, @Body() dto: SelectContextDto) {
    return this.auth.selectContext(user, dto);
  }

  @AuthOnly()
  @HttpCode(204)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser) {
    await this.auth.logout(user.sessionId);
  }
}