import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Le nom complet doit comporter au moins 2 caractères' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Adresse Gmail invalide' })
  gmailUser?: string;

  @IsOptional()
  @IsString()
  gmailAppPassword?: string;

  @IsOptional()
  @IsString()
  template?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'Le nouveau mot de passe doit comporter au moins 8 caractères',
  })
  newPassword?: string;
}
