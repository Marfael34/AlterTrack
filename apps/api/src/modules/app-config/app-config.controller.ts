import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import {
  AppConfigService,
  buildStandardCvFileName,
  CV_MAX_SIZE_BYTES,
  CV_UNSUPPORTED_FORMAT_MESSAGE,
} from './app-config.service';
import { CvUploadExceptionFilter } from './cv-upload-exception.filter';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  async getConfig(@CurrentUser() user?: AuthenticatedUser) {
    const config = await this.appConfigService.getOrCreateConfig();
    // Un chemin en base ne suffit pas : le fichier peut avoir disparu du disque
    // (redéploiement d'un hébergeur sans disque persistant).
    const userHasCv = Boolean(
      this.appConfigService.resolveStoredFile(user?.cvFilePath),
    );
    const hasCv =
      userHasCv ||
      Boolean(this.appConfigService.resolveStoredFile(config.cvFilePath));
    const cvOriginalName = !hasCv
      ? null
      : userHasCv
        ? user?.cvOriginalName || buildStandardCvFileName(user?.fullName)
        : config.cvOriginalName || null;

    return {
      id: config.id,
      template: user?.template || config.template,
      hasCv,
      cvOriginalName,
      cvFileSize: userHasCv ? (user?.cvFileSize ?? null) : null,
      cvUploadedAt: userHasCv ? (user?.cvUploadedAt ?? null) : null,
      expoPushToken: user?.expoPushToken || config.expoPushToken,
      updatedAt: config.updatedAt,
    };
  }

  @Patch('template')
  updateTemplate(@Body() updateDto: UpdateTemplateDto) {
    return this.appConfigService.updateTemplate(updateDto.template);
  }

  @Patch('push-token')
  updatePushToken(@Body() updateDto: UpdatePushTokenDto) {
    return this.appConfigService.updatePushToken(updateDto.expoPushToken);
  }

  @Post('cv')
  @UseFilters(CvUploadExceptionFilter)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: CV_MAX_SIZE_BYTES,
        files: 1,
      },
      fileFilter: (req, file, callback) => {
        const name = (file.originalname || '').toLowerCase();
        const mime = (file.mimetype || '').toLowerCase();

        const isAllowedMime =
          mime.includes('pdf') ||
          mime === 'application/octet-stream' ||
          mime === 'binary/octet-stream' ||
          mime.includes('download') ||
          mime === 'application/unknown' ||
          !mime;

        const isPdfExt = name.endsWith('.pdf');

        if (isAllowedMime || isPdfExt) {
          return callback(null, true);
        }

        return callback(
          new BadRequestException(CV_UNSUPPORTED_FORMAT_MESSAGE),
          false,
        );
      },
    }),
  )
  async uploadCv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const saved = await this.appConfigService.saveCv(file, user?.id);
    return {
      hasCv: true,
      cvOriginalName: saved.cvOriginalName,
      cvFileSize: saved.cvFileSize,
      cvUploadedAt: saved.cvUploadedAt,
      message: 'CV enregistré et synchronisé avec succès.',
    };
  }

  @Get('cv/download')
  async downloadCv(
    @Res() res: Response,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const { filePath, originalName } =
      await this.appConfigService.getCvFileForUser(user?.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(originalName)}"`,
    );

    res.sendFile(filePath);
  }

  @Delete('cv')
  deleteCv(@CurrentUser() user?: AuthenticatedUser) {
    return this.appConfigService.deleteCv(user?.id);
  }
}
