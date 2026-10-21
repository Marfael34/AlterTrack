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
      if (key === 'APK_DOWNLOAD_URL') return 'https://github.com/Marfael34/AlterTrack/releases/download/v1.0.0/altertrack.apk';
      return null;
    });

    const info = service.getApkInfo();
    expect(info.isExternal).toBe(true);
    expect(info.externalUrl).toBe('https://github.com/Marfael34/AlterTrack/releases/download/v1.0.0/altertrack.apk');
  });

  it('should generate valid landing page html with doctype and title', () => {
    const html = service.getLandingHtml('https://altertrack.app');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('AlterTrack');
    expect(html).toContain('Télécharger l\'APK');
    expect(html).toContain('Guide d\'installation');
  });

  it('should generate friendly not found html', () => {
    const html = service.getNotFoundHtml();
    expect(html).toContain('Build APK en cours');
  });
});
