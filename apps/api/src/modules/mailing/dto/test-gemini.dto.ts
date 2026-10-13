import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EmailNature } from '../../gemini/dto/generate-email.dto';

export class TestGeminiDto {
  @IsString()
  @IsNotEmpty({
    message: "Le nom de l'entreprise est obligatoire pour le test",
  })
  @MaxLength(255)
  companyName!: string;

  @IsOptional()
  @IsEnum(EmailNature)
  nature?: EmailNature;
}
