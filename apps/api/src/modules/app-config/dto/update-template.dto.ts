import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsString({ message: 'Le modèle doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le modèle de mail ne peut pas être vide' })
  @MaxLength(10000, {
    message: 'Le modèle de mail ne peut excéder 10000 caractères',
  })
  template!: string;
}
