import { IsArray, IsOptional, IsString } from 'class-validator';

export class SendBatchDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  companyIds?: string[];
}
