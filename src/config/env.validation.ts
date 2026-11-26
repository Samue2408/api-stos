import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(NodeEnv) NODE_ENV!: NodeEnv;
  @IsInt() @Min(1) PORT: number = 3000;

  @IsString() DB_HOST!: string;
  @IsInt() DB_PORT!: number;
  @IsString() DB_USER!: string;
  @IsString() DB_PASSWORD!: string;
  @IsString() DB_NAME!: string;

  @IsString() @MinLength(32) JWT_ACCESS_SECRET!: string;
  @IsString() JWT_ACCESS_TTL!: string;
  @IsInt() @Min(1) REFRESH_TTL_DAYS!: number;

  @IsString() APP_NAME: string = 'Mi App';
  @IsIn(['console', 'smtp']) MAIL_DRIVER: 'console' | 'smtp' = 'console';
  @IsString() MAIL_FROM: string = 'Mi App <no-reply@localhost>';

  @ValidateIf((o) => o.MAIL_DRIVER === 'smtp') @IsString() SMTP_HOST!: string;
  @ValidateIf((o) => o.MAIL_DRIVER === 'smtp') @IsInt() SMTP_PORT!: number;
  @ValidateIf((o) => o.MAIL_DRIVER === 'smtp') @IsString() SMTP_USER!: string;
  @ValidateIf((o) => o.MAIL_DRIVER === 'smtp')
  @IsString()
  SMTP_PASSWORD!: string;

  @IsString() @MinLength(32) OTP_SECRET!: string;
  @IsInt() @Min(1) @Max(60) OTP_TTL_MINUTES: number = 10;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n${errors.toString()}`);
  }
  if (
    validated.NODE_ENV === 'production' &&
    validated.MAIL_DRIVER === 'console'
  ) {
    throw new Error(
      'MAIL_DRIVER=console no está permitido en producción (imprimiría los códigos en el log)',
    );
  }
  return validated;
}
