import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth/auth-user';
import { AllowPendingPasswordChange, AuthOnly, CurrentUser, Public } from '../../common/auth/decorators';
import { ClientIp } from '../../common/http/client-ip.decorator';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './password.dto';
import { PasswordService } from './password.service';

@Controller('auth/password')
export class PasswordController {
  constructor(private readonly passwords: PasswordService) {}

  @AuthOnly()
  @AllowPendingPasswordChange()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('change')
  change(@CurrentUser() u: AuthUser, @Body() dto: ChangePasswordDto, @ClientIp() ip: string | null) {
    return this.passwords.change(u, dto, ip);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.passwords.forgot(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset')
  reset(@Body() dto: ResetPasswordDto, @ClientIp() ip: string | null) {
    return this.passwords.reset(dto, ip);
  }
}