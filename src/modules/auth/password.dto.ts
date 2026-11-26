import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(1) @MaxLength(200) currentPassword!: string;
  @IsString() @MinLength(10) @MaxLength(128) newPassword!: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(320) email!: string;
}

export class ResetPasswordDto {
  @IsEmail() @MaxLength(320) email!: string;
  @Matches(/^\d{6}$/, { message: 'El código son 6 dígitos' }) code!: string;
  @IsString() @MinLength(10) @MaxLength(128) newPassword!: string;
}