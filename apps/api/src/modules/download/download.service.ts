import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { renderDownloadPage } from './download.template';

export interface ApkInfo {
  exists: boolean;
  isExternal?: boolean;
  externalUrl?: string;
  path?: string;
  filename: string;
  version: string;
  size: string;
  sizeBytes: number;
  releaseDate: string;
  releaseUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
}

export interface GithubReleaseInfo {
  version: string;
  publishedAt: string;
  releaseUrl: string;
  releaseNotes: string;
  apkUrl?: string;
  apkName?: string;
  apkSizeBytes?: number;
}

interface GithubReleaseResponse {
  tag_name?: string;
  published_at?: string;
  html_url?: string;
  body?: string | null;
  assets?: { name: string; size: number; browser_download_url: string }[];
}

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);
  private readonly defaultVersion = '1.0.0';
  private readonly defaultFilename = 'altertrack-v1.0.0.apk';
  private readonly defaultGithubRepo = 'Marfael34/AlterTrack';
  private readonly releaseCacheTtlMs = 10 * 60 * 1000;
  private releaseCache: {
    value: GithubReleaseInfo | null;
    fetchedAt: number;
  } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private formatDateFr(date: Date): string {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  private formatSize(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  /**
   * Récupère la dernière release GitHub publiée (mise en cache 10 min).
   * Chaque tag v* pousse une release avec l'APK (workflow build-apk.yml) :
   * c'est donc la source de vérité pour la version disponible.
   */
  async getLatestRelease(): Promise<GithubReleaseInfo | null> {
    const now = Date.now();
    if (
      this.releaseCache &&
      now - this.releaseCache.fetchedAt < this.releaseCacheTtlMs
    ) {
      return this.releaseCache.value;
    }

    const repo =
      this.configService.get<string>('GITHUB_REPO') ||
      process.env.GITHUB_REPO ||
      this.defaultGithubRepo;
    const token =
      this.configService.get<string>('GITHUB_TOKEN') ||
      process.env.GITHUB_TOKEN;

    try {
      const res = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'AlterTrack-API',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) {
        throw new Error(`GitHub a répondu ${res.status}`);
      }
      const data = (await res.json()) as GithubReleaseResponse;
      if (!data.tag_name) {
        throw new Error('Release sans tag');
      }
      const apk = data.assets?.find((a) => a.name.endsWith('.apk'));
      const value: GithubReleaseInfo = {
        version: data.tag_name.replace(/^v/i, ''),
        publishedAt: data.published_at || new Date().toISOString(),
        releaseUrl: data.html_url || `https://github.com/${repo}/releases`,
        releaseNotes: (data.body || '').trim(),
        apkUrl: apk?.browser_download_url,
        apkName: apk?.name,
        apkSizeBytes: apk?.size,
      };
      this.releaseCache = { value, fetchedAt: now };
      return value;
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Impossible de lire la dernière release GitHub : ${reason}`,
      );
      // En cas d'échec, on garde l'ancienne valeur et on réessaie dans 1 min
      const previous = this.releaseCache?.value ?? null;
      this.releaseCache = {
        value: previous,
        fetchedAt: now - this.releaseCacheTtlMs + 60 * 1000,
      };
      return previous;
    }
  }

  /**
   * Infos APK enrichies avec la dernière release GitHub (version, date, taille, lien).
   * Retombe sur getApkInfo() si GitHub est injoignable.
   */
  async getResolvedApkInfo(): Promise<ApkInfo> {
    const base = this.getApkInfo();
    const release = await this.getLatestRelease();
    if (!release) {
      return base;
    }

    const hasApkAsset = Boolean(release.apkUrl);
    return {
      ...base,
      exists: base.exists || hasApkAsset,
      isExternal: hasApkAsset ? true : base.isExternal,
      externalUrl: release.apkUrl || base.externalUrl,
      filename: release.apkName || `AlterTrack-v${release.version}.apk`,
      version: release.version,
      size: release.apkSizeBytes
        ? this.formatSize(release.apkSizeBytes)
        : base.size,
      sizeBytes: release.apkSizeBytes || base.sizeBytes,
      releaseDate: this.formatDateFr(new Date(release.publishedAt)),
      releaseUrl: release.releaseUrl,
      releaseNotes: release.releaseNotes,
      publishedAt: release.publishedAt,
    };
  }

  /**
   * Analyse et résout les métadonnées et le chemin de l'APK
   */
  getApkInfo(): ApkInfo {
    const externalUrl =
      this.configService.get<string>('APK_DOWNLOAD_URL') ||
      process.env.APK_DOWNLOAD_URL;

    if (externalUrl && externalUrl.trim() !== '') {
      return {
        exists: true,
        isExternal: true,
        externalUrl: externalUrl.trim(),
        filename: this.defaultFilename,
        version: this.defaultVersion,
        size: '~45 Mo',
        sizeBytes: 0,
        releaseDate: new Date().toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      };
    }

    const customPath =
      this.configService.get<string>('APK_FILE_PATH') ||
      process.env.APK_FILE_PATH;

    const uploadDir =
      this.configService.get<string>('uploadDir') ||
      process.env.UPLOAD_DIR ||
      './uploads';

    const candidates = [
      customPath,
      path.join(uploadDir, 'altertrack.apk'),
      path.join(uploadDir, this.defaultFilename),
      path.resolve(process.cwd(), 'uploads/altertrack.apk'),
      path.resolve(process.cwd(), `uploads/${this.defaultFilename}`),
      path.resolve(process.cwd(), 'apps/api/uploads/altertrack.apk'),
      path.resolve(process.cwd(), `apps/api/uploads/${this.defaultFilename}`),
      '/app/uploads/altertrack.apk',
      `/app/uploads/${this.defaultFilename}`,
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        try {
          const stats = fs.statSync(candidate);
          let sizeFormatted = `${(stats.size / (1024 * 1024)).toFixed(1)} Mo`;
          if (stats.size < 1024 * 1024) {
            sizeFormatted =
              stats.size > 10240
                ? `${(stats.size / 1024).toFixed(0)} Ko`
                : '42.5 Mo';
          }
          const releaseDateFormatted = stats.mtime.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          });

          return {
            exists: true,
            path: candidate,
            filename: this.defaultFilename,
            version: this.defaultVersion,
            size: sizeFormatted,
            sizeBytes: stats.size,
            releaseDate: releaseDateFormatted,
          };
        } catch (err: any) {
          this.logger.warn(
            `Impossible de lire les infos de l'APK sur ${candidate}: ${err.message}`,
          );
        }
      }
    }

    return {
      exists: false,
      filename: this.defaultFilename,
      version: this.defaultVersion,
      size: '42.5 Mo',
      sizeBytes: 0,
      releaseDate: new Date().toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
    };
  }

  /**
   * Génère le HTML de la landing page de téléchargement
   */
  async getLandingHtml(origin?: string): Promise<string> {
    const info = await this.getResolvedApkInfo();
    const downloadUrl = info.externalUrl || '/download/apk';

    return renderDownloadPage({
      appName: 'AlterTrack',
      version: info.version,
      fileSize: info.size,
      releaseDate: info.releaseDate,
      apkDownloadUrl: downloadUrl,
      apiUrl: '/health',
      releaseUrl: info.releaseUrl,
      releaseNotes: info.releaseNotes,
    });
  }

  /**
   * Page HTML conviviale de secours si aucun fichier APK n'est encore déployé
   */
  getNotFoundHtml(): string {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlterTrack — Fichier APK en cours de déploiement</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    body {
      background-color: #070A12;
      color: #F3F4F6;
      font-family: 'Inter', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: rgba(17, 24, 39, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px 32px;
      max-width: 520px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      backdrop-filter: blur(16px);
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 26px;
      margin-bottom: 16px;
      background: linear-gradient(90deg, #00D2C4, #0066FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p {
      color: #9CA3AF;
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .code-box {
      background: #030712;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px 16px;
      font-family: monospace;
      font-size: 13px;
      color: #38BDF8;
      text-align: left;
      margin-bottom: 24px;
      overflow-x: auto;
    }
    .btn {
      display: inline-block;
      background: #0066FF;
      color: #FFF;
      text-decoration: none;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 12px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #1A75FF;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>📦 Build APK en cours</h1>
    <p>Le fichier APK d'AlterTrack n'a pas encore été déposé sur ce serveur ou le lien distant est en cours de configuration.</p>
    <div class="code-box">
      # Pour activer le téléchargement immédiat :<br>
      cp altertrack.apk apps/api/uploads/altertrack.apk<br>
      # Ou définir la variable d'environnement :<br>
      APK_DOWNLOAD_URL=https://...
    </div>
    <a href="/" class="btn">Retour à la page d'accueil</a>
  </div>
</body>
</html>`;
  }
}
