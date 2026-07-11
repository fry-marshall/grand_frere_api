import { Injectable } from '@nestjs/common';
import {
  INotificationSender,
  NotificationData,
} from './notification-sender.interface';
import { NotificationType } from '../notification.types';
import { NotificationFirebase } from '../notification.firebase';

@Injectable()
export class NotificationSenderService implements INotificationSender {
  constructor(private readonly firebase: NotificationFirebase) {}

  async sendNotification(
    userId: string,
    data: NotificationData,
    type: NotificationType,
  ): Promise<void> {
    await this.firebase.send(userId, data.title, data.body, {
      type,
      ...(data.orderId ? { orderId: data.orderId } : {}),
    });
  }
}
