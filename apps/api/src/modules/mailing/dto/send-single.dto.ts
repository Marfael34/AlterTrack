import { IsOptional, IsString } from 'class-validator';

export class SendSingleDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  body?: string;
}
