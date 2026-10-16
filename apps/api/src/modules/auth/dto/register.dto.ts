import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Une adresse e-mail valide est requise' })
  @IsNotEmpty({ message: 'L’adresse e-mail est obligatoire' })
  email!: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères pour des raisons de sécurité',
  })
  password!: string;

  @IsString({ message: 'Le nom complet doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom complet est obligatoire' })
  @MinLength(2, { message: 'Le nom complet doit comporter au moins 2 caractères' })
  fullName!: string;
}
