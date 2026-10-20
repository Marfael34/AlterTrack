import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { CompaniesService } from './companies.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createCompanyDto: CreateCompanyDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.create(createCompanyDto, user?.id);
  }

  private readonly logger = new Logger(CompaniesController.name);

  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 Mo max
      },
      fileFilter: (req, file, callback) => {
        const allowedExts = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext && !allowedExts.includes(ext)) {
          return callback(
            new BadRequestException(
              `Format non supporté (${ext}). Veuillez envoyer un fichier .xlsx, .xls ou .csv`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  importSpreadsheet(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { fileBase64?: string; fileName?: string },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    if (file && file.buffer && file.buffer.length > 0) {
      this.logger.log(
        `Import reçu via Multipart : "${file.originalname}" (${file.buffer.length} octets)`,
      );
      return this.companiesService.importFromSpreadsheet(file.buffer, user?.id);
    }

    if (body?.fileBase64 && body.fileBase64.length > 0) {
      const buffer = Buffer.from(body.fileBase64, 'base64');
      this.logger.log(
        `Import reçu via Base64 : "${body.fileName ?? 'tableur'}" (${buffer.length} octets)`,
      );
      return this.companiesService.importFromSpreadsheet(buffer, user?.id);
    }

    throw new BadRequestException(
      'Aucun fichier fourni ou fichier vide (0 octet).',
    );
  }

  @Get('stats')
  getStats(@CurrentUser() user?: AuthenticatedUser) {
    return this.companiesService.getStats(user?.id);
  }

  @Get('cities')
  getCities(@CurrentUser() user?: AuthenticatedUser) {
    return this.companiesService.getCities(user?.id);
  }

  @Get()
  findAll(
    @Query() query: QueryCompanyDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.findAll(query, user?.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.findOne(id, user?.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.update(id, updateCompanyDto, user?.id);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateCompanyStatusDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.updateStatus(id, updateStatusDto.status, user?.id);
  }

  @Delete('batch')
  @HttpCode(HttpStatus.OK)
  removeBatch(
    @Body() body: { ids?: string[]; all?: boolean },
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.removeBatch(body, user?.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.remove(id, user?.id);
  }

  @Get(':id/activities')
  getActivities(
    @Param('id') id: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.getActivities(id, user?.id);
  }

  @Post(':id/activities')
  @HttpCode(HttpStatus.CREATED)
  addActivity(
    @Param('id') id: string,
    @Body() createActivityDto: CreateActivityDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.addActivity(id, createActivityDto, user?.id);
  }

  @Patch(':id/activities/:activityId')
  @HttpCode(HttpStatus.OK)
  updateActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.updateActivity(
      id,
      activityId,
      updateActivityDto,
      user?.id,
    );
  }

  @Delete(':id/activities/:activityId')
  @HttpCode(HttpStatus.OK)
  deleteActivity(
    @Param('id') id: string,
    @Param('activityId') activityId: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.companiesService.deleteActivity(id, activityId, user?.id);
  }
}
