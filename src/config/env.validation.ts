import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min, MinLength, validateSync } from 'class-validator';

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
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n${errors.toString()}`);
  }
  return validated;
}