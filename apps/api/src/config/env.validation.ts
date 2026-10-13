import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty({ message: 'API_KEY is required to secure communication' })
  @MinLength(16, { message: 'API_KEY must be at least 16 characters long' })
  API_KEY!: string;

  @IsString()
  @IsOptional()
  UPLOAD_DIR: string = './uploads';

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  GMAIL_USER?: string;

  @IsString()
  @IsOptional()
  GMAIL_APP_PASSWORD?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Configuration validation error: ${errorMessages}`);
  }

  return validatedConfig;
}
