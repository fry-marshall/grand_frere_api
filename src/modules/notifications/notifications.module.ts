import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_SENDER } from './shared/notification-sender.interface';
import { NoopNotificationSenderService } from './shared/noop-notification-sender.service';
import { OrderExpiryScheduler } from './schedulers/order-expiry.scheduler';
import { VendorSummaryScheduler } from './schedulers/vendor-summary.scheduler';
import { Order } from '../orders/entities/order.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../wallets/entities/transaction.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { OrderItem } from '../orders/entities/order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      Order,
      OrderItem,
      Wallet,
      Transaction,
      Student,
      StudentParent,
      Vendor,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    { provide: NOTIFICATION_SENDER, useClass: NoopNotificationSenderService },
    OrderExpiryScheduler,
    VendorSummaryScheduler,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
