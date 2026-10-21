import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as path from 'path';
import { Public } from '../../common/decorators/public.decorator';
import { DownloadService } from './download.service';

@Controller()
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  /**
   * Page d'accueil / vitrine de téléchargement (GET /)
   */
  @Public()
  @Get()
  getHomePage(@Req() req: Request, @Res() res: Response) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const html = this.downloadService.getLandingHtml(origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  /**
   * Route alternative de téléchargement (GET /download)
   */
  @Public()
  @Get('download')
  getDownloadPage(@Req() req: Request, @Res() res: Response) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const html = this.downloadService.getLandingHtml(origin);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  /**
   * Téléchargement direct du binaire APK Android (GET /download/apk)
   */
  @Public()
  @Get('download/apk')
  downloadApk(@Res() res: Response) {
    const info = this.downloadService.getApkInfo();

    // Si une URL de build distant (EAS ou GitHub Release) est configurée
    if (info.isExternal && info.externalUrl) {
      return res.redirect(302, info.externalUrl);
    }

    // Si le fichier APK physique existe sur le disque
    if (info.exists && info.path) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${info.filename}"`,
      );
      if (info.sizeBytes > 0) {
        res.setHeader('Content-Length', info.sizeBytes.toString());
      }
      return res.sendFile(path.resolve(info.path));
    }

    // Sinon, page d'information conviviale
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(this.downloadService.getNotFoundHtml());
  }

  /**
   * Endpoint JSON de métadonnées pour vérifier l'état du binaire APK (GET /api/apk-info)
   */
  @Public()
  @Get('api/apk-info')
  getApkInfo() {
    const info = this.downloadService.getApkInfo();
    return {
      available: info.exists,
      version: info.version,
      filename: info.filename,
      size: info.size,
      sizeBytes: info.sizeBytes,
      releaseDate: info.releaseDate,
      downloadUrl: info.externalUrl || '/download/apk',
      isExternal: Boolean(info.isExternal),
    };
  }
}
