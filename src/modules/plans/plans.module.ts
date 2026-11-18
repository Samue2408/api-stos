import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanEntity } from './entities/plan.entity';
import { PlanModuleEntity } from './entities/plan-module.entity';

@Module({ imports: [TypeOrmModule.forFeature([PlanEntity, PlanModuleEntity])] })
export class PlansModule {}