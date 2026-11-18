import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// role_scope no se mapea: default 'tenant' en BD + FK compuesta
@Entity('tenant_users')
export class TenantUserEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenantId!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid' }) roleId!: string;
  @Column({ type: 'enum', enumName: 'membership_status', enum: ['active', 'invited', 'inactive'] })
  status!: 'active' | 'invited' | 'inactive';
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}