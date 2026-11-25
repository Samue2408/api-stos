// tenants/platform-tenants.controller.ts
import {
  Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { ClientIp } from '../../common/http/client-ip.decorator';
import { RequirePermissions } from '../access-control/decorators';
import {
  ChangePlanDto, CreateTenantDto, ListTenantsDto, StatusReasonDto, UpdateTenantDto,
} from './dto';
import { TenantsAdminService } from './tenants-admin.service';

@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly tenants: TenantsAdminService) {}

  @Get()
  @RequirePermissions('tenants:read')
  list(@Query() q: ListTenantsDto) { return this.tenants.list(q); }

  @Get(':id')
  @RequirePermissions('tenants:read')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.tenants.get(id); }

  @Post()
  @RequirePermissions('tenants:manage')
  create(@Body() dto: CreateTenantDto, @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.create(dto, u, ip);
  }

  @Patch(':id')
  @RequirePermissions('tenants:manage')
  rename(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto,
         @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.rename(id, dto.name, u, ip);
  }

  @Put(':id/plan')
  @RequirePermissions('tenants:manage')
  changePlan(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangePlanDto,
             @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.changePlan(id, dto.planId, u, ip);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @RequirePermissions('tenants:manage')
  suspend(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusReasonDto,
          @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.changeStatus(id, 'suspended', dto.reason, u, ip);
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @RequirePermissions('tenants:manage')
  reactivate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusReasonDto,
             @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.changeStatus(id, 'active', dto.reason, u, ip);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions('tenants:manage')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusReasonDto,
         @CurrentUser() u: AuthUser, @ClientIp() ip: string | null) {
    return this.tenants.changeStatus(id, 'cancelled', dto.reason, u, ip);
  }
}