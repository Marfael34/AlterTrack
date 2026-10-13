import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum EmailNature {
  FIRST_CONTACT = 'FIRST_CONTACT',
  FOLLOW_UP = 'FOLLOW_UP',
}

export class GenerateEmailDto {
  @IsString()
  @IsNotEmpty({ message: "Le nom de l'entreprise est obligatoire" })
  @MaxLength(255)
  companyName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Le modèle de base est obligatoire' })
  @MaxLength(10000)
  template!: string;

  @IsEnum(EmailNature)
  nature: EmailNature = EmailNature.FIRST_CONTACT;
}

export interface GeneratedEmailResult {
  subject: string;
  body: string;
}
