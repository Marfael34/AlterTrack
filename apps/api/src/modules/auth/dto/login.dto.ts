import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Une adresse e-mail valide est requise' })
  @IsNotEmpty({ message: 'L’adresse e-mail est obligatoire' })
  email!: string;

  @IsString({ message: 'Le mot de passe est obligatoire' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire' })
  password!: string;
}
