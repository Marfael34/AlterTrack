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
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { AppConfigService, buildStandardCvFileName } from './app-config.service';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  async getConfig(@CurrentUser() user?: AuthenticatedUser) {
    const config = await this.appConfigService.getOrCreateConfig();
    const hasCv = Boolean(user?.cvFilePath || config.cvFilePath);
    const cvOriginalName =
      user?.cvOriginalName ||
      (user?.cvFilePath ? buildStandardCvFileName(user.fullName) : null) ||
      config.cvOriginalName ||
      null;

    return {
      id: config.id,
      template: user?.template || config.template,
      hasCv,
      cvOriginalName,
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
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 Mo max
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
          new BadRequestException('Seuls les fichiers PDF sont acceptés'),
          false,
        );
      },
    }),
  )
  async uploadCv(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    const updated = await this.appConfigService.saveCv(file, user?.id);
    return {
      id: updated.id,
      hasCv: true,
      cvOriginalName: updated.cvOriginalName,
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
