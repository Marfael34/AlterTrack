import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DownloadService } from './download.service';

describe('DownloadService', () => {
  let service: DownloadService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloadService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'uploadDir') return './uploads';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DownloadService>(DownloadService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return default apk info if no file exists', () => {
    const info = service.getApkInfo();
    expect(info).toBeDefined();
    expect(info.version).toBe('1.0.0');
    expect(info.filename).toBe('altertrack-v1.0.0.apk');
    expect(info.exists).toBeDefined();
  });

  it('should handle external download url when configured', () => {
    jest.spyOn(configService, 'get').mockImplementation((key: string) => {
      if (key === 'APK_DOWNLOAD_URL')
        return 'https://github.com/Marfael34/AlterTrack/releases/download/v1.0.0/altertrack.apk';
      return null;
    });

    const info = service.getApkInfo();
    expect(info.isExternal).toBe(true);
    expect(info.externalUrl).toBe(
      'https://github.com/Marfael34/AlterTrack/releases/download/v1.0.0/altertrack.apk',
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should generate valid landing page html with doctype and title', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('réseau coupé'));
    const html = await service.getLandingHtml('https://altertrack.app');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AlterTrack');
    expect(html).toContain("Télécharger l'APK");
    expect(html).toContain("Guide d'installation");
  });

  it('should use the latest GitHub release for version, size and link', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          tag_name: 'v1.2.3',
          published_at: '2026-11-27T08:56:02Z',
          html_url:
            'https://github.com/Marfael34/AlterTrack/releases/tag/v1.2.3',
          body: 'Pagination des fiches',
          assets: [
            {
              name: 'app-release.apk',
              size: 81224073,
              browser_download_url:
                'https://github.com/Marfael34/AlterTrack/releases/download/v1.2.3/app-release.apk',
            },
          ],
        }),
    } as Response);

    const info = await service.getResolvedApkInfo();
    expect(info.version).toBe('1.2.3');
    expect(info.isExternal).toBe(true);
    expect(info.externalUrl).toContain('/v1.2.3/app-release.apk');
    expect(info.size).toBe('77.5 Mo');
    expect(info.releaseNotes).toBe('Pagination des fiches');

    // Deuxième appel servi par le cache : pas de nouvelle requête GitHub
    await service.getResolvedApkInfo();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const html = await service.getLandingHtml();
    expect(html).toContain('v1.2.3');
    expect(html).toContain('Nouveautés de la version 1.2.3');
  });

  it('should read the latest release from the redirect when the GitHub API fails', async () => {
    const apkUrl =
      'https://github.com/Marfael34/AlterTrack/releases/download/v1.3.0/AlterTrack-v1.3.0.apk';
    jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith('https://api.github.com')) {
        return Promise.resolve({ ok: false, status: 403 } as Response);
      }
      if (url.endsWith('/releases/latest')) {
        return Promise.resolve({
          ok: false,
          status: 302,
          headers: new Headers({
            location:
              'https://github.com/Marfael34/AlterTrack/releases/tag/v1.3.0',
          }),
        } as Response);
      }
      if (url === apkUrl) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-length': '81232397',
            'last-modified': 'Fri, 27 Nov 2026 10:41:18 GMT',
          }),
        } as Response);
      }
      return Promise.reject(new Error(`URL inattendue : ${url}`));
    });

    const info = await service.getResolvedApkInfo();
    expect(info.version).toBe('1.3.0');
    expect(info.externalUrl).toBe(apkUrl);
    expect(info.filename).toBe('AlterTrack-v1.3.0.apk');
    expect(info.size).toBe('77.5 Mo');
    expect(info.publishedAt).toBe('2026-11-27T10:41:18.000Z');
  });

  it('should link to the release page instead of a 404 when the APK name is unexpected', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.startsWith('https://api.github.com')) {
        return Promise.resolve({ ok: false, status: 403 } as Response);
      }
      if (url.endsWith('/releases/latest')) {
        return Promise.resolve({
          ok: false,
          status: 302,
          headers: new Headers({
            location:
              'https://github.com/Marfael34/AlterTrack/releases/tag/v1.2.2',
          }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        headers: new Headers(),
      } as Response);
    });

    const info = await service.getResolvedApkInfo();
    expect(info.version).toBe('1.2.2');
    expect(info.externalUrl).toBe(
      'https://github.com/Marfael34/AlterTrack/releases/tag/v1.2.2',
    );
  });

  it('should fall back to local info when GitHub is unreachable', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('réseau coupé'));
    const info = await service.getResolvedApkInfo();
    expect(info.version).toBe('1.0.0');
  });

  it('should generate friendly not found html', () => {
    const html = service.getNotFoundHtml();
    expect(html).toContain('Build APK en cours');
  });
});
