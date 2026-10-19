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

export function buildStandardCvFileName(fullName?: string | null): string {
  if (!fullName || !fullName.trim()) {
    return 'candidat_CV.pdf';
  }

  // Remplacer les tirets et underscores par des espaces pour traiter les noms composés
  const normalizedSpaces = fullName.trim().replace(/[-_]+/g, ' ');
  const rawParts = normalizedSpaces.split(/\s+/).filter(Boolean);
  if (rawParts.length === 0) return 'candidat_CV.pdf';

  const cleanPart = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();

  if (rawParts.length === 1) {
    const single = cleanPart(rawParts[0]);
    return single ? `${single}_CV.pdf` : 'candidat_CV.pdf';
  }

  let nom = '';
  let prenom = '';

  const firstWord = rawParts[0];
  const isFirstWordAllUpper =
    firstWord.length > 1 &&
    firstWord === firstWord.toUpperCase() &&
    rawParts.slice(1).some((w) => w !== w.toUpperCase());

  if (isFirstWordAllUpper) {
    nom = cleanPart(firstWord);
    prenom = rawParts.slice(1).map(cleanPart).filter(Boolean).join('_');
  } else {
    prenom = cleanPart(rawParts[0]);
    nom = rawParts.slice(1).map(cleanPart).filter(Boolean).join('_');
  }

  nom = nom || 'nom';
  prenom = prenom || 'prenom';

  return `${nom}_${prenom}_CV.pdf`;
}

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

  async saveCv(file: Express.Multer.File, userId?: string) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Aucun fichier fourni ou fichier vide');
    }

    const name = (file.originalname || '').toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    // Vérification des magic bytes PDF (%PDF-)
    const hasPdfMagic =
      file.buffer.length >= 4 &&
      file.buffer.subarray(0, 4).toString('ascii') === '%PDF';

    const isPdfExt = name.endsWith('.pdf');
    const isPdfMime =
      mime.includes('pdf') ||
      mime === 'application/octet-stream' ||
      mime === 'binary/octet-stream';

    if (!hasPdfMagic && !isPdfExt) {
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

    let userFullName: string | null = null;
    if (userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true },
      });
      userFullName = u?.fullName || null;
    }

    // Génération du nom de fichier uniforme : nom_prenom_CV.pdf
    const standardName = buildStandardCvFileName(userFullName);
    const safeFilename = `cv_${userId || 'global'}_${Date.now()}_${randomBytes(8).toString('hex')}.pdf`;
    const targetPath = path.join(this.uploadDir, safeFilename);

    // Écriture du fichier sur le disque
    fs.writeFileSync(targetPath, file.buffer);

    const updatedConfig = await this.prisma.appConfig.update({
      where: { id: config.id },
      data: {
        cvFilePath: targetPath,
        cvOriginalName: standardName,
      },
    });

    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          cvFilePath: targetPath,
          cvOriginalName: standardName,
        },
      });
      this.logger.log(
        `CV PDF enregistré avec succès pour l'utilisateur ${userId} (${standardName}).`,
      );
    } else {
      this.logger.log(
        `CV PDF enregistré avec succès au niveau global (${standardName}).`,
      );
    }

    return updatedConfig;
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

  async getCvFileForUser(userId?: string): Promise<{
    filePath: string;
    originalName: string;
  }> {
    const uploadBoundary = this.uploadDir.endsWith(path.sep)
      ? this.uploadDir
      : `${this.uploadDir}${path.sep}`;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cvFilePath: true, cvOriginalName: true, fullName: true },
      });

      if (user?.cvFilePath && fs.existsSync(user.cvFilePath)) {
        const resolved = path.resolve(user.cvFilePath);
        if (resolved.startsWith(uploadBoundary)) {
          return {
            filePath: resolved,
            originalName:
              user.cvOriginalName || buildStandardCvFileName(user.fullName),
          };
        }
      }
    }

    const config = await this.getOrCreateConfig();
    if (config.cvFilePath && fs.existsSync(config.cvFilePath)) {
      const resolved = path.resolve(config.cvFilePath);
      if (resolved.startsWith(uploadBoundary)) {
        return {
          filePath: resolved,
          originalName: config.cvOriginalName || 'CV.pdf',
        };
      }
    }

    throw new NotFoundException(
      'Aucun CV PDF actif trouvé sur le serveur pour cet utilisateur',
    );
  }

  async deleteCv(userId?: string): Promise<{ success: boolean; message: string }> {
    const uploadBoundary = this.uploadDir.endsWith(path.sep)
      ? this.uploadDir
      : `${this.uploadDir}${path.sep}`;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cvFilePath: true },
      });

      if (user?.cvFilePath) {
        try {
          const resolved = path.resolve(user.cvFilePath);
          if (resolved.startsWith(uploadBoundary) && fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
          }
        } catch (err) {
          this.logger.warn(`Impossible de supprimer le fichier CV utilisateur: ${err}`);
        }

        await this.prisma.user.update({
          where: { id: userId },
          data: {
            cvFilePath: null,
            cvOriginalName: null,
          },
        });
      }
    }

    const config = await this.getOrCreateConfig();
    if (config.cvFilePath) {
      try {
        const resolved = path.resolve(config.cvFilePath);
        if (resolved.startsWith(uploadBoundary) && fs.existsSync(resolved)) {
          fs.unlinkSync(resolved);
        }
      } catch (err) {
        this.logger.warn(`Impossible de supprimer le fichier CV global: ${err}`);
      }

      await this.prisma.appConfig.update({
        where: { id: config.id },
        data: {
          cvFilePath: null,
          cvOriginalName: null,
        },
      });
    }

    return {
      success: true,
      message: 'CV supprimé avec succès',
    };
  }
}
