import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { SessionContext } from '../../../common/auth/auth-user';

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid', nullable: true }) tenantId!: string | null;
  @Column({ type: 'varchar', length: 10 }) context!: SessionContext;
  @Column({ type: 'text', unique: true }) tokenHash!: string;
  @Column({ type: 'timestamptz' }) expiresAt!: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}