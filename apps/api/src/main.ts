import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, new ExpressAdapter());

  // Sécurité des en-têtes HTTP (avec autorisation cross-origin et CSP pour la landing page)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https://api.qrserver.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  const configService = app.get(ConfigService);
  const corsOriginsRaw =
    configService.get<string>('corsOrigins') || process.env.CORS_ORIGINS;
  const corsOrigin =
    corsOriginsRaw && corsOriginsRaw !== '*'
      ? corsOriginsRaw.split(',').map((o) => o.trim())
      : true;

  // Configuration CORS
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'Accept'],
    credentials: true,
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

  const port = configService.get<number>('port') || 3000;

  await app.listen(port, '0.0.0.0');
  logger.log(`Serveur AlterTrack API démarré sur le port ${port}`);
}

void bootstrap();
