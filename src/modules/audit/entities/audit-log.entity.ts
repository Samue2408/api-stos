import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid', nullable: true }) tenantId!: string | null;
  @Column({ type: 'uuid', nullable: true }) actorId!: string | null;
  @Column({ length: 100 }) action!: string;
  @Column({ type: 'varchar', length: 60, nullable: true }) entityType!: string | null;
  @Column({ type: 'uuid', nullable: true }) entityId!: string | null;
  @Column({ type: 'jsonb', default: {} }) metadata!: Record<string, unknown>;
  @Column({ type: 'inet', nullable: true }) ip!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}