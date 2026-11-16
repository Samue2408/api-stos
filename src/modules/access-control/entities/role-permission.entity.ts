import { Entity, PrimaryColumn } from 'typeorm';

@Entity('role_permissions')
export class RolePermissionEntity {
  @PrimaryColumn({ type: 'uuid' }) roleId!: string;
  @PrimaryColumn({ type: 'uuid' }) permissionId!: string;
}