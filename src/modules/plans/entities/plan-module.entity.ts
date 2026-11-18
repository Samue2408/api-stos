import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('plan_modules')
export class PlanModuleEntity {
  @PrimaryColumn({ type: 'uuid' }) planId!: string;
  @PrimaryColumn({ type: 'uuid' }) moduleId!: string;
  @Column({ type: 'jsonb', default: {} }) configuration!: Record<string, unknown>;
}