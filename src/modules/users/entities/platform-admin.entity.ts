import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// role_scope no se mapea: la BD lo rellena con 'platform' y lo valida con la FK compuesta
@Entity('platform_admins')
export class PlatformAdminEntity {
  @PrimaryColumn({ type: 'uuid' }) userId!: string;
  @Column({ type: 'uuid' }) roleId!: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
}