import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import configuration from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { AppConfigModule } from './modules/app-config/app-config.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { HealthModule } from './modules/health/health.module';
import { MailingModule } from './modules/mailing/mailing.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    HealthModule,
    CompaniesModule,
    AppConfigModule,
    GeminiModule,
    MailingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
