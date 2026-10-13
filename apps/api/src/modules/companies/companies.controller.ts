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
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateCompanyStatusDto } from './dto/update-company-status.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
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
  ) {
    if (file && file.buffer && file.buffer.length > 0) {
      this.logger.log(
        `Import reçu via Multipart : "${file.originalname}" (${file.buffer.length} octets)`,
      );
      return this.companiesService.importFromSpreadsheet(file.buffer);
    }

    if (body?.fileBase64 && body.fileBase64.length > 0) {
      const buffer = Buffer.from(body.fileBase64, 'base64');
      this.logger.log(
        `Import reçu via Base64 : "${body.fileName ?? 'tableur'}" (${buffer.length} octets)`,
      );
      return this.companiesService.importFromSpreadsheet(buffer);
    }

    throw new BadRequestException(
      'Aucun fichier fourni ou fichier vide (0 octet).',
    );
  }

  @Get('stats')
  getStats() {
    return this.companiesService.getStats();
  }

  @Get()
  findAll(@Query() query: QueryCompanyDto) {
    return this.companiesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateCompanyStatusDto,
  ) {
    return this.companiesService.updateStatus(id, updateStatusDto.status);
  }

  @Delete('batch')
  @HttpCode(HttpStatus.OK)
  removeBatch(@Body() body: { ids?: string[]; all?: boolean }) {
    return this.companiesService.removeBatch(body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
