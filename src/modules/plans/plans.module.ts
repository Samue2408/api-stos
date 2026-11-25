import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessControlModule } from '../access-control/access-control.module';
import { AuditModule } from '../audit/audit.module';
import { PlanEntity } from './entities/plan.entity';
import { PlanModuleEntity } from './entities/plan-module.entity';
import { PlansService } from './plans.service';
import { PlatformModulesController } from './platform-modules.controller';
import { PlatformPlansController } from './platform-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlanEntity, PlanModuleEntity]), AuditModule, AccessControlModule],
  controllers: [PlatformPlansController, PlatformModulesController],
  providers: [PlansService],
})
export class PlansModule {}