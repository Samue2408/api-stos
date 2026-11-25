import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditModule } from '../audit/audit.module';
import { TenantEntity } from './entities/tenant.entity';
import { TenantUserEntity } from './entities/tenant-user.entity';
import { PlatformTenantsController } from './platform-tenants.controller';
import { TenantsAdminService } from './tenants-admin.service';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, TenantUserEntity]), AuditModule, AccessControlModule],
  controllers: [PlatformTenantsController],
  providers: [TenantsService, TenantsAdminService],
  exports: [TenantsService],
})
export class TenantsModule {}