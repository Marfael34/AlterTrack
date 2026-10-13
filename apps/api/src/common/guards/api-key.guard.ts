import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
      throw new UnauthorizedException(
        'Clé API manquante ou invalide (en-tête x-api-key requis)',
      );
    }

    const configuredApiKey = this.configService.get<string>('apiKey');
    if (!configuredApiKey) {
      throw new UnauthorizedException('Clé API serveur non configurée');
    }

    const providedBuffer = Buffer.from(apiKeyHeader);
    const configuredBuffer = Buffer.from(configuredApiKey);

    if (
      providedBuffer.length !== configuredBuffer.length ||
      !timingSafeEqual(providedBuffer, configuredBuffer)
    ) {
      throw new UnauthorizedException('Clé API non autorisée');
    }

    return true;
  }
}
