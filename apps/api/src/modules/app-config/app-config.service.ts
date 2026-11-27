import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';

export const CV_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const CV_TOO_LARGE_MESSAGE = 'Le fichier dépasse 10 Mo.';
export const CV_UNSUPPORTED_FORMAT_MESSAGE =
  'Format non pris en charge. Importez un fichier PDF.';

const PDF_MAGIC_BYTES = '%PDF-';

export function isPdfBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= PDF_MAGIC_BYTES.length &&
    buffer.subarray(0, PDF_MAGIC_BYTES.length).toString('ascii') ===
      PDF_MAGIC_BYTES
  );
}

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

  /**
   * Retourne le chemin absolu d'un fichier s'il existe et se trouve bien dans
   * le répertoire d'upload (protection contre la traversée de répertoires).
   */
  resolveStoredFile(filePath?: string | null): string | null {
    if (!filePath) return null;
    const resolved = path.resolve(filePath);
    const uploadBoundary = this.uploadDir.endsWith(path.sep)
      ? this.uploadDir
      : `${this.uploadDir}${path.sep}`;
    if (!resolved.startsWith(uploadBoundary)) return null;
    return fs.existsSync(resolved) ? resolved : null;
  }

  private removeStoredFile(filePath?: string | null) {
    const resolved = this.resolveStoredFile(filePath);
    if (!resolved) return;
    try {
      fs.unlinkSync(resolved);
    } catch (err) {
      this.logger.warn(`Impossible de supprimer l'ancien CV : ${String(err)}`);
    }
  }

  /**
   * Le CV global (miroir utilisé par les envois sans utilisateur) peut pointer
   * vers le fichier d'un compte : on ne le supprime que s'il n'est plus référencé.
   */
  private async removeGlobalFileIfUnreferenced(filePath?: string | null) {
    if (!filePath) return;
    const references = await this.prisma.user.count({
      where: { cvFilePath: filePath },
    });
    if (references === 0) {
      this.removeStoredFile(filePath);
    }
  }

  async saveCv(file: Express.Multer.File | undefined, userId?: string) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Aucun fichier fourni ou fichier vide.');
    }

    if (file.buffer.length > CV_MAX_SIZE_BYTES) {
      throw new PayloadTooLargeException(CV_TOO_LARGE_MESSAGE);
    }

    // Le contenu fait foi : le nom et le type MIME envoyés par le téléphone
    // ne sont pas fiables (Android omet souvent l'extension ou le MIME).
    if (!isPdfBuffer(file.buffer)) {
      throw new BadRequestException(CV_UNSUPPORTED_FORMAT_MESSAGE);
    }

    const config = await this.getOrCreateConfig();
    let previousUserPath: string | null = null;
    let userFullName: string | null = null;
    if (userId) {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, cvFilePath: true },
      });
      userFullName = u?.fullName || null;
      previousUserPath = u?.cvFilePath || null;
    }

    const standardName = buildStandardCvFileName(userFullName);
    const safeFilename = `cv_${userId || 'global'}_${Date.now()}_${randomBytes(8).toString('hex')}.pdf`;
    const targetPath = path.join(this.uploadDir, safeFilename);
    const tempPath = `${targetPath}.part`;
    const uploadedAt = new Date();
    const fileSize = file.buffer.length;

    // Écriture dans un fichier temporaire puis renommage : un envoi interrompu
    // ne laisse jamais de PDF tronqué à la place du CV actif.
    try {
      fs.writeFileSync(tempPath, file.buffer);
      fs.renameSync(tempPath, targetPath);
    } catch (err) {
      this.removeStoredFile(tempPath);
      this.logger.error(
        `Échec d'écriture du CV sur le disque : ${String(err)}`,
      );
      throw new InternalServerErrorException(
        "L'enregistrement du CV a échoué. Veuillez réessayer.",
      );
    }

    try {
      await this.prisma.$transaction([
        this.prisma.appConfig.update({
          where: { id: config.id },
          data: { cvFilePath: targetPath, cvOriginalName: standardName },
        }),
        ...(userId
          ? [
              this.prisma.user.update({
                where: { id: userId },
                data: {
                  cvFilePath: targetPath,
                  cvOriginalName: standardName,
                  cvFileSize: fileSize,
                  cvUploadedAt: uploadedAt,
                },
              }),
            ]
          : []),
      ]);
    } catch (err) {
      // La base n'a pas été mise à jour : l'ancien CV reste actif et intact.
      this.removeStoredFile(targetPath);
      this.logger.error(
        `Échec d'enregistrement du CV en base : ${String(err)}`,
      );
      throw new InternalServerErrorException(
        "L'enregistrement du CV a échoué. Veuillez réessayer.",
      );
    }

    // L'ancien fichier n'est supprimé qu'une fois le nouveau CV bien enregistré.
    if (previousUserPath && previousUserPath !== targetPath) {
      this.removeStoredFile(previousUserPath);
    }
    if (
      config.cvFilePath &&
      config.cvFilePath !== targetPath &&
      config.cvFilePath !== previousUserPath
    ) {
      await this.removeGlobalFileIfUnreferenced(config.cvFilePath);
    }

    this.logger.log(
      `CV PDF enregistré pour ${userId ? `l'utilisateur ${userId}` : 'la configuration globale'} (${standardName}).`,
    );

    return {
      cvOriginalName: standardName,
      cvFileSize: fileSize,
      cvUploadedAt: uploadedAt,
    };
  }

  async getCvFilePath(): Promise<string> {
    const config = await this.getOrCreateConfig();
    const resolved = this.resolveStoredFile(config.cvFilePath);

    if (!resolved) {
      throw new NotFoundException('Aucun CV PDF enregistré sur le serveur');
    }

    return resolved;
  }

  async getCvFileForUser(userId?: string): Promise<{
    filePath: string;
    originalName: string;
  }> {
    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cvFilePath: true, cvOriginalName: true, fullName: true },
      });

      const resolved = this.resolveStoredFile(user?.cvFilePath);
      if (user && resolved) {
        return {
          filePath: resolved,
          originalName:
            user.cvOriginalName || buildStandardCvFileName(user.fullName),
        };
      }
    }

    const config = await this.getOrCreateConfig();
    const resolved = this.resolveStoredFile(config.cvFilePath);
    if (resolved) {
      return {
        filePath: resolved,
        originalName: config.cvOriginalName || 'CV.pdf',
      };
    }

    throw new NotFoundException(
      'Aucun CV PDF actif trouvé sur le serveur pour cet utilisateur',
    );
  }

  async deleteCv(
    userId?: string,
  ): Promise<{ success: boolean; message: string }> {
    let deletedUserPath: string | null = null;

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { cvFilePath: true },
      });

      if (user?.cvFilePath) {
        deletedUserPath = user.cvFilePath;
        this.removeStoredFile(user.cvFilePath);
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            cvFilePath: null,
            cvOriginalName: null,
            cvFileSize: null,
            cvUploadedAt: null,
          },
        });
      }
    }

    // Le miroir global n'est effacé que s'il correspond au CV supprimé
    // (ou si la requête n'est pas liée à un compte), pour ne pas retirer
    // le CV d'un autre utilisateur.
    const config = await this.getOrCreateConfig();
    if (
      config.cvFilePath &&
      (!userId || config.cvFilePath === deletedUserPath)
    ) {
      await this.removeGlobalFileIfUnreferenced(config.cvFilePath);
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
