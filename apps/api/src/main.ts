import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Sécurité des en-têtes HTTP
  app.use(helmet());

  // Configuration CORS
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
  });

  // Validation globale stricte des entrées
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Gestion de l'arrêt gracieux
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;

  await app.listen(port);
  logger.log(`Serveur AlterTrack API démarré sur le port ${port}`);
}

void bootstrap();
