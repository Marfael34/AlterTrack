import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SendTestEmailDto {
  @IsEmail({}, { message: 'Une adresse email valide est requise pour le test' })
  @IsNotEmpty({
    message: 'L’adresse email du destinataire test est obligatoire',
  })
  toEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;
}
