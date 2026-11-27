import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { CV_TOO_LARGE_MESSAGE } from './app-config.service';

/**
 * Multer rejette les fichiers trop lourds avec un message anglais (« File too large »).
 * Ce filtre le remplace par le message affiché à l'utilisateur.
 */
@Catch(PayloadTooLargeException)
export class CvUploadExceptionFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
      message: CV_TOO_LARGE_MESSAGE,
      error: 'Payload Too Large',
    });
  }
}
