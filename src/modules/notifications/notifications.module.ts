import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NOTIFICATION_SENDER } from './shared/notification-sender.interface';
import { NoopNotificationSenderService } from './shared/noop-notification-sender.service';
import { NotificationSenderService } from './shared/notification-sender.service';
import { NotificationFirebase } from './notification.firebase';
import { OrderExpiryScheduler } from './schedulers/order-expiry.scheduler';
import { VendorSummaryScheduler } from './schedulers/vendor-summary.scheduler';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../wallets/entities/transaction.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
      }),
    }),
    TypeOrmModule.forFeature([
      Notification,
      Order,
      OrderItem,
      Wallet,
      Transaction,
      Student,
      StudentParent,
      Vendor,
      User,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationFirebase,
    {
      provide: NOTIFICATION_SENDER,
      inject: [ConfigService, NotificationFirebase],
      useFactory: (config: ConfigService, firebase: NotificationFirebase) =>
        config.get('NODE_ENV') === 'prod'
          ? new NotificationSenderService(firebase)
          : new NoopNotificationSenderService(),
    },
    OrderExpiryScheduler,
    VendorSummaryScheduler,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
