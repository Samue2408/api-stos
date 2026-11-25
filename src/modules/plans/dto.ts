import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString,
  Matches, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class PlanModuleItemDto {
  @IsString() code!: string;
  /** Límites propios del módulo en este plan (p. ej. { maxInvoicesPerMonth: 500 }). */
  @IsOptional() @IsObject() configuration?: Record<string, unknown>;
}

export class CreatePlanDto {
  @IsString() @Matches(/^[a-z0-9][a-z0-9_-]{1,49}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsInt() @Min(1) @Max(1_000_000) maxUsers!: number;
  @IsInt() @Min(0) @Max(1_000_000) maxProjects!: number;
  @IsInt() @Min(0) @Max(1e15) storageLimitBytes!: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique((m: PlanModuleItemDto) => m.code)
  @ValidateNested({ each: true })
  @Type(() => PlanModuleItemDto)
  modules?: PlanModuleItemDto[];
}

/** El code no se edita; los módulos tienen su propio endpoint. */
export class UpdatePlanDto extends PartialType(OmitType(CreatePlanDto, ['code', 'modules'] as const)) {}

export class SetPlanModulesDto {
  @IsArray()
  @ArrayUnique((m: PlanModuleItemDto) => m.code)
  @ValidateNested({ each: true })
  @Type(() => PlanModuleItemDto)
  modules!: PlanModuleItemDto[];

  /** Obligatorio para quitar módulos de un plan que ya tiene tenants. */
  @IsOptional() @IsBoolean() confirmRemoval?: boolean;
}