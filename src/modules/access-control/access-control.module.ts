import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleEntity } from './entities/module.entity';
import { PermissionEntity } from './entities/permission.entity';
import { RoleEntity } from './entities/role.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { CatalogSyncService } from './sync/catalog-sync.service';
import { MeController } from './me.controller';
import { AccessService } from './access.service';

@Module({
  imports: [TypeOrmModule.forFeature([ModuleEntity, PermissionEntity, RoleEntity, RolePermissionEntity])],
  controllers: [MeController],
  providers: [CatalogSyncService, AccessService],
  exports: [AccessService],
})
export class AccessControlModule {}