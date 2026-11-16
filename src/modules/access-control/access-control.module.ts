import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleEntity } from './entities/module.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { CatalogSyncService } from './sync/catalog-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModuleEntity, PermissionEntity, RoleEntity, RolePermissionEntity]),
  ],
  providers: [CatalogSyncService],
})
export class AccessControlModule {}