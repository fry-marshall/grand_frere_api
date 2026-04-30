import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationType } from './notification.types';
import type { INotificationSender } from './shared/notification-sender.interface';
import {
  NOTIFICATION_SENDER,
  NotificationData,
} from './shared/notification-sender.interface';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

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
        (error as Error).stack,
      );
      throw error;
    }
  }

  async findAll(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<{ data: NotificationResponseDto[]; meta: object }> {
    const { page, limit } = query;
    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: notifications.map((n) => this.toDto(n)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });
    if (!notification)
      throw new NotFoundException(ErrorMessages.NOTIFICATIONS.NOT_FOUND);

    await this.notificationRepo.update(id, { isRead: true });
    return this.toDto({ ...notification, isRead: true });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  private toDto(n: Notification): NotificationResponseDto {
    return {
      id: n.id,
      userId: n.userId,
      title: n.title,
      body: n.body,
      type: n.type,
      data: n.data ?? null,
      isRead: n.isRead,
      createdAt: n.createdAt,
    };
  }
}
