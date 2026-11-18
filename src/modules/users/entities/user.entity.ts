import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'citext', unique: true }) email!: string;
  @Column({ type: 'text' }) passwordHash!: string;
  @Column({ length: 120 }) firstName!: string;
  @Column({ length: 120 }) lastName!: string;
  @Column({ type: 'enum', enumName: 'user_status', enum: ['active', 'inactive', 'blocked'] })
  status!: 'active' | 'inactive' | 'blocked';
  @Column({ default: false }) mustChangePassword!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}