import { Test, TestingModule } from '@nestjs/testing';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';
import type { Request, Response } from 'express';

describe('DownloadController', () => {
  let controller: DownloadController;
  let service: DownloadService;

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.setHeader = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.sendFile = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  const mockRequest = () => {
    return {
      protocol: 'https',
      get: jest.fn().mockReturnValue('api.altertrack.app'),
    } as unknown as Request;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DownloadController],
      providers: [
        {
          provide: DownloadService,
          useValue: {
            getLandingHtml: jest.fn().mockResolvedValue('<html>Landing</html>'),
            getNotFoundHtml: jest
              .fn()
              .mockReturnValue('<html>Not Found</html>'),
            getResolvedApkInfo: jest.fn().mockResolvedValue({
              exists: true,
              filename: 'altertrack-v1.0.0.apk',
              version: '1.0.0',
              size: '42.5 Mo',
              sizeBytes: 44564480,
              releaseDate: '21 octobre 2026',
              path: '/app/uploads/altertrack.apk',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DownloadController>(DownloadController);
    service = module.get<DownloadService>(DownloadService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should serve home page with text/html header', async () => {
    const req = mockRequest();
    const res = mockResponse();

    await controller.getHomePage(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/html; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('<html>Landing</html>');
  });

  it('should serve download page via /download', async () => {
    const req = mockRequest();
    const res = mockResponse();

    await controller.getDownloadPage(req, res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/html; charset=utf-8',
    );
    expect(res.send).toHaveBeenCalledWith('<html>Landing</html>');
  });

  it('should return APK binary when available', async () => {
    const res = mockResponse();

    await controller.downloadApk(res);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/vnd.android.package-archive',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="altertrack-v1.0.0.apk"',
    );
    expect(res.sendFile).toHaveBeenCalled();
  });

  it('should redirect if external APK URL is configured', async () => {
    jest.spyOn(service, 'getResolvedApkInfo').mockResolvedValue({
      exists: true,
      isExternal: true,
      externalUrl: 'https://cdn.altertrack.app/altertrack.apk',
      filename: 'altertrack-v1.0.0.apk',
      version: '1.0.0',
      size: '42.5 Mo',
      sizeBytes: 0,
      releaseDate: '21 octobre 2026',
    });

    const res = mockResponse();
    await controller.downloadApk(res);

    expect(res.redirect).toHaveBeenCalledWith(
      302,
      'https://cdn.altertrack.app/altertrack.apk',
    );
  });

  it('should return JSON metadata on /api/apk-info', async () => {
    const info = await controller.getApkInfo();
    expect(info).toBeDefined();
    expect(info.available).toBe(true);
    expect(info.version).toBe('1.0.0');
    expect(info.downloadUrl).toBe('/download/apk');
  });
});
