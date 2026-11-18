import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('tenants')
export class TenantEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 200 }) name!: string;
  @Column({ length: 100, unique: true }) slug!: string;
  @Column({ type: 'enum', enumName: 'tenant_status', enum: ['active', 'suspended', 'cancelled'] })
  status!: 'active' | 'suspended' | 'cancelled';
  @Column({ type: 'uuid' }) planId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}