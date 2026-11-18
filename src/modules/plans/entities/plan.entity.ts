import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('plans')
export class PlanEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ length: 50, unique: true }) code!: string;
  @Column({ length: 120 }) name!: string;
  @Column({ type: 'int' }) maxUsers!: number;
  @Column({ type: 'int' }) maxProjects!: number;
  @Column({ type: 'bigint' }) storageLimitBytes!: string; // bigint llega como string
  @Column({ default: true }) isActive!: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt!: Date;
}