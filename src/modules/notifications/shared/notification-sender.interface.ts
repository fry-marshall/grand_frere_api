import { NotificationType } from '../notification.types';

export interface NotificationData {
  title: string;
  body: string;
}

export interface INotificationSender {
  sendNotification(
    userId: string,
    data: NotificationData,
    type: NotificationType,
  ): Promise<void>;
}

export const NOTIFICATION_SENDER = 'NOTIFICATION_SENDER';
