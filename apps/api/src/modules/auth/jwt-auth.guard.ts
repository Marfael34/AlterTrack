import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const apiKeyHeader =
      request.headers['x-api-key'] ||
      request.query?.apiKey ||
      request.query?.['x-api-key'];
    const expectedKey = this.configService.get<string>('apiKey');

    // Autoriser les scripts système, requêtes web ou liens directs authentifiés par API_KEY (timing-safe)
    if (apiKeyHeader && expectedKey && typeof apiKeyHeader === 'string') {
      const headerBuffer = Buffer.from(apiKeyHeader);
      const expectedBuffer = Buffer.from(expectedKey);

      if (
        headerBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(headerBuffer, expectedBuffer)
      ) {
        // Associer au premier utilisateur système par défaut si aucun Bearer token
        if (!request.headers['authorization']) {
          const defaultUser = await this.prisma.user.findFirst({
            select: {
              id: true,
              email: true,
              fullName: true,
              gmailUser: true,
              gmailAppPassword: true,
              template: true,
              cvFilePath: true,
              cvOriginalName: true,
              expoPushToken: true,
            },
          });
          if (defaultUser) {
            request.user = defaultUser;
          }
          return true;
        }
      }
    }

    // Support du token JWT via query parameter (pour l'ouverture de documents/liens dans le navigateur externe)
    const queryToken = request.query?.token;
    if (
      queryToken &&
      typeof queryToken === 'string' &&
      !request.headers['authorization']
    ) {
      request.headers['authorization'] = `Bearer ${queryToken}`;
    }

    // Sinon, authentification JWT standard
    const can = (await super.canActivate(context)) as boolean;
    return can;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(
          'Accès non autorisé : veuillez vous connecter avec un compte valide',
        )
      );
    }
    return user;
  }
}
