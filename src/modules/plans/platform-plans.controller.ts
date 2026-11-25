import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ClientIp } from '../../common/http/client-ip.decorator';
import { RequirePermissions } from '../access-control/decorators';
import { CreatePlanDto, SetPlanModulesDto, UpdatePlanDto } from './dto';
import { PlansService } from './plans.service';

@Controller('platform/plans')
export class PlatformPlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @RequirePermissions('plans:read')
  list() { return this.plans.list(); }

  @Get(':id')
  @RequirePermissions('plans:read')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.plans.get(id); }

  @Post()
  @RequirePermissions('plans:manage')
  create(@Body() dto: CreatePlanDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.plans.create(dto, u, ip);
  }

  @Patch(':id')
  @RequirePermissions('plans:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto,
         @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.plans.update(id, dto, u, ip);
  }

  /** Reemplaza el conjunto completo de módulos del plan. */
  @Put(':id/modules')
  @RequirePermissions('plans:manage')
  setModules(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetPlanModulesDto,
             @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.plans.setModules(id, dto, u, ip);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions('plans:manage')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.plans.setActive(id, false, u, ip);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermissions('plans:manage')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.plans.setActive(id, true, u, ip);
  }
}