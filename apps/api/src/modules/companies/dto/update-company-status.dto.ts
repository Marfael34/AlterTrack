import { Status } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateCompanyStatusDto {
  @IsEnum(Status, {
    message: 'Le statut fourni est invalide',
  })
  @IsNotEmpty({ message: 'Le champ statut est obligatoire' })
  status!: Status;
}
