import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString({ message: 'Le token Push doit être une chaîne' })
  @IsNotEmpty({ message: 'Le token Push est obligatoire' })
  @MaxLength(255)
  expoPushToken!: string;
}
