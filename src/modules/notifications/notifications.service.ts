import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './notification.types';
import type { INotificationSender } from './shared/notification-sender.interface';
import {
  NOTIFICATION_SENDER,
  NotificationData,
} from './shared/notification-sender.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @Inject(NOTIFICATION_SENDER)
    private readonly sender: INotificationSender,
  ) {}

  async createNotification(
    type: NotificationType,
    userId: string,
    data: NotificationData,
  ): Promise<void> {
    try {
      await this.notificationRepo.save({
        userId,
        title: data.title,
        body: data.body,
        type,
      });
      await this.sender.sendNotification(userId, data, type);
    } catch (error) {
      this.logger.error(
        `Failed to create notification type=${type} user=${userId}`,
        error.stack,
      );
      throw error;
    }
  }
}
