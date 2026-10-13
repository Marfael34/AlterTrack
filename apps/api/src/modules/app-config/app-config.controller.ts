import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AppConfigService } from './app-config.service';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Controller('config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  async getConfig() {
    const config = await this.appConfigService.getOrCreateConfig();
    return {
      id: config.id,
      template: config.template,
      hasCv: Boolean(config.cvFilePath),
      cvOriginalName: config.cvOriginalName,
      expoPushToken: config.expoPushToken,
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
        if (file.mimetype !== 'application/pdf') {
          return callback(
            new BadRequestException('Seuls les fichiers PDF sont acceptés'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  uploadCv(@UploadedFile() file: Express.Multer.File) {
    return this.appConfigService.saveCv(file);
  }

  @Get('cv/download')
  async downloadCv(@Res() res: Response) {
    const filePath = await this.appConfigService.getCvFilePath();
    const config = await this.appConfigService.getOrCreateConfig();

    res.download(filePath, config.cvOriginalName || 'CV.pdf');
  }
}
