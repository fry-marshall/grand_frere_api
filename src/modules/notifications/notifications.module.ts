import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NOTIFICATION_SENDER } from './shared/notification-sender.interface';
import { NoopNotificationSenderService } from './shared/noop-notification-sender.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  providers: [
    NotificationsService,
    { provide: NOTIFICATION_SENDER, useClass: NoopNotificationSenderService },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
