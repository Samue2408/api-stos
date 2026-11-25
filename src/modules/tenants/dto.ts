import { Type } from 'class-transformer';
import {
  IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength, ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { SLUG_REGEX } from './constants';

export class InitialAdminDto {
  @IsEmail() @MaxLength(320) email!: string;
  @IsString() @MinLength(1) @MaxLength(120) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(120) lastName!: string;
}

export class CreateTenantDto {
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
  @IsString() @Matches(SLUG_REGEX, { message: 'slug inválido (3-63 caracteres: a-z, 0-9 y guiones)' }) slug!: string;
  @IsUUID() planId!: string;
  @ValidateNested() @Type(() => InitialAdminDto) admin!: InitialAdminDto;
}

export class UpdateTenantDto {
  @IsString() @MinLength(2) @MaxLength(200) name!: string;
}

export class ChangePlanDto {
  @IsUUID() planId!: string;
}

export class StatusReasonDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ListTenantsDto extends PaginationDto {
  @IsOptional() @IsIn(['active', 'suspended', 'cancelled']) status?: 'active' | 'suspended' | 'cancelled';
  @IsOptional() @IsUUID() planId?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}