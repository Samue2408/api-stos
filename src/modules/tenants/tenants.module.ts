import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantEntity } from './entities/tenant.entity';
import { TenantUserEntity } from './entities/tenant-user.entity';
import { TenantsService } from './tenants.service';

@Module({
  imports: [TypeOrmModule.forFeature([TenantEntity, TenantUserEntity])],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}