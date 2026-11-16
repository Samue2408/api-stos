import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { ScopeType } from '../define-module';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 50, unique: true }) code!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'enum', enumName: 'scope_type', enum: ['platform', 'tenant'] })
  scope!: ScopeType;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}