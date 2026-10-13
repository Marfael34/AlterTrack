import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
