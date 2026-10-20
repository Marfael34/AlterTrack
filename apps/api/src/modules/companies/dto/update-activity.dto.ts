import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsOptional()
  @IsString()
  performedAt?: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}
