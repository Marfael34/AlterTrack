import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_MAIL_TEMPLATE = `Bonjour,

Actuellement à la recherche d'une opportunité en alternance, je me permets de vous contacter pour vous soumettre ma candidature au sein de votre entreprise.

Vous trouverez ci-joint mon CV détaillant mes compétences et réalisations.

Restant à votre entière disposition pour un échange téléphonique ou un entretien, je vous remercie par avance pour l'attention portée à ma démarche.

Bien cordialement,`;

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly uploadDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const rawDir = this.configService.get<string>('uploadDir') || './uploads';
    this.uploadDir = path.resolve(process.cwd(), rawDir);

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getOrCreateConfig() {
    let config = await this.prisma.appConfig.findFirst();

    if (!config) {
      config = await this.prisma.appConfig.create({
        data: {
          template: DEFAULT_MAIL_TEMPLATE,
        },
      });
      this.logger.log('Default AppConfig created in database.');
    }

    return config;
  }

  async updateTemplate(template: string) {
    const config = await this.getOrCreateConfig();

    return this.prisma.appConfig.update({
      where: { id: config.id },
      data: { template },
    });
  }

  async updatePushToken(expoPushToken: string) {
    const config = await this.getOrCreateConfig();

    return this.prisma.appConfig.update({
      where: { id: config.id },
      data: { expoPushToken },
    });
  }

  async saveCv(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    // Vérification stricte du type MIME
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Seuls les fichiers PDF sont acceptés');
    }

    const config = await this.getOrCreateConfig();

    // Suppression sécurisée de l'ancien CV s'il existe
    if (config.cvFilePath) {
      try {
        const oldResolved = path.resolve(config.cvFilePath);
        const uploadBoundary = this.uploadDir.endsWith(path.sep)
          ? this.uploadDir
          : `${this.uploadDir}${path.sep}`;

        if (
          oldResolved.startsWith(uploadBoundary) &&
          fs.existsSync(oldResolved)
        ) {
          fs.unlinkSync(oldResolved);
        }
      } catch (err) {
        this.logger.warn(`Impossible de supprimer l'ancien CV: ${err}`);
      }
    }

    // Génération d'un nom de fichier sécurisé et unique (évite toute traversée de chemin)
    const sanitizedOriginalName = path.basename(file.originalname);
    const safeFilename = `cv_${Date.now()}_${randomBytes(8).toString('hex')}.pdf`;
    const targetPath = path.join(this.uploadDir, safeFilename);

    // Écriture du fichier sur le disque
    fs.writeFileSync(targetPath, file.buffer);

    return this.prisma.appConfig.update({
      where: { id: config.id },
      data: {
        cvFilePath: targetPath,
        cvOriginalName: sanitizedOriginalName,
      },
    });
  }

  async getCvFilePath(): Promise<string> {
    const config = await this.getOrCreateConfig();

    if (!config.cvFilePath || !fs.existsSync(config.cvFilePath)) {
      throw new NotFoundException('Aucun CV PDF enregistré sur le serveur');
    }

    const resolved = path.resolve(config.cvFilePath);
    const uploadBoundary = this.uploadDir.endsWith(path.sep)
      ? this.uploadDir
      : `${this.uploadDir}${path.sep}`;

    if (!resolved.startsWith(uploadBoundary)) {
      throw new BadRequestException(
        'Chemin de fichier hors du répertoire autorisé',
      );
    }

    return resolved;
  }
}
