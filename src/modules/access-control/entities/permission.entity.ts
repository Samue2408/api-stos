import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { PermissionType, ScopeType } from '../define-module';

@Entity('permissions')
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) moduleId!: string;
  @Column({ length: 100, unique: true }) code!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'enum', enumName: 'permission_type', enum: ['module_access', 'action'] })
  type!: PermissionType;
  @Column({ type: 'enum', enumName: 'scope_type', enum: ['platform', 'tenant'] })
  scope!: ScopeType;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}