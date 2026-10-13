import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from '../app-config/app-config.service';
import { PushNotificationService } from './push-notification.service';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let appConfigService: {
    getOrCreateConfig: jest.Mock;
  };

  beforeEach(async () => {
    appConfigService = {
      getOrCreateConfig: jest.fn().mockResolvedValue({
        id: 'cfg-1',
        expoPushToken: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        { provide: AppConfigService, useValue: appConfigService },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should simulate push notification when no token is registered', async () => {
    const result = await service.sendPushNotification({
      title: 'Titre Test',
      body: 'Corps du message',
    });

    expect(result).toBe(false);
  });

  it('should call fetch and send notification when token is registered', async () => {
    appConfigService.getOrCreateConfig.mockResolvedValueOnce({
      id: 'cfg-1',
      expoPushToken: 'ExponentPushToken[mock-token-123]',
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: { status: 'ok' } }),
    });
    global.fetch = mockFetch;

    const result = await service.sendPushNotification({
      title: 'Nouvelle réponse',
      body: 'Réponse reçue de Acme Corp',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(result).toBe(true);
  });
});
