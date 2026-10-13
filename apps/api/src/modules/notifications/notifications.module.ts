import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { PushNotificationService } from './push-notification.service';

@Module({
  imports: [AppConfigModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class NotificationsModule {}
