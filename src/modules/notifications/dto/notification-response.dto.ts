import { NotificationType } from '../notification.types';

export class NotificationResponseDto {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}
