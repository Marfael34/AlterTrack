import { Module } from '@nestjs/common';
import { MailingModule } from '../mailing/mailing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [MailingModule, NotificationsModule],
  controllers: [SchedulerController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
