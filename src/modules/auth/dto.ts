import { IsEmail, IsIn, IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
}

export class RefreshDto {
  @IsString() @MinLength(20) refreshToken!: string;
}

export class SelectContextDto {
  @IsIn(['platform', 'tenant']) type!: 'platform' | 'tenant';
  @ValidateIf((o) => o.type === 'tenant') @IsUUID() tenantId?: string;
}