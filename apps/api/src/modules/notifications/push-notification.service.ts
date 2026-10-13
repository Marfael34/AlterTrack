import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../app-config/app-config.service';

export interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly appConfigService: AppConfigService) {}

  async sendPushNotification(payload: PushMessagePayload): Promise<boolean> {
    try {
      const config = await this.appConfigService.getOrCreateConfig();

      if (!config.expoPushToken) {
        this.logger.log(
          `[PUSH SIMULATION] Aucun token Expo Push enregistré. Notification simulée : [${payload.title}] ${payload.body}`,
        );
        return false;
      }

      const body = {
        to: config.expoPushToken,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        priority: 'high',
        data: payload.data || {},
      };

      const response = await fetch(this.expoPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.warn(
          `Échec de l'envoi de notification Expo Push (HTTP ${response.status})`,
        );
        return false;
      }

      const result = (await response.json()) as { data?: { status?: string } };
      this.logger.log(
        `Notification Push Expo envoyée avec succès à ${config.expoPushToken}: ${JSON.stringify(result)}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'envoi de la notification push: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
