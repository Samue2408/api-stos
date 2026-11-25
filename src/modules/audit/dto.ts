import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';

export class AuditQueryDto extends PaginationDto {
  @IsOptional() @IsUUID() tenantId?: string;
  @IsOptional() @IsUUID() actorId?: string;
  /** Prefijo: 'tenant.' trae tenant.created, tenant.suspended, etc. */
  @IsOptional() @IsString() @MaxLength(100) action?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}