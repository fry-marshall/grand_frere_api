import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationSender,
  NotificationData,
} from './notification-sender.interface';
import { NotificationType } from '../notification.types';

@Injectable()
export class NoopNotificationSenderService implements INotificationSender {
  private readonly logger = new Logger(NoopNotificationSenderService.name);

  sendNotification(
    userId: string,
    data: NotificationData,
    type: NotificationType,
  ): Promise<void> {
    this.logger.debug(
      `[NOOP] Notification skipped for user ${userId} type=${type}: ${data.title}`,
    );
    return Promise.resolve();
  }
}
