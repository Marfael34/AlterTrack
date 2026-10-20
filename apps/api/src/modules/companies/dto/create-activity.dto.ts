import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActivityDto {
  @IsNotEmpty({ message: "Le titre de l'action est obligatoire" })
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title!: string;

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
