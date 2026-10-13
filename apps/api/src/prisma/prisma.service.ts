import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('Connecting to PostgreSQL database via Prisma...');
    await this.$connect();
    this.logger.log('Successfully connected to PostgreSQL database.');
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from PostgreSQL database...');
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL database.');
  }
}
