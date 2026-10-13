import { Module } from '@nestjs/common';
import { AppConfigModule } from '../app-config/app-config.module';
import { GeminiModule } from '../gemini/gemini.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmailService } from './email.service';
import { ImapService } from './imap.service';
import { MailingController } from './mailing.controller';
import { MailingService } from './mailing.service';

@Module({
  imports: [GeminiModule, AppConfigModule, NotificationsModule],
  controllers: [MailingController],
  providers: [EmailService, ImapService, MailingService],
  exports: [MailingService, EmailService, ImapService],
})
export class MailingModule {}
