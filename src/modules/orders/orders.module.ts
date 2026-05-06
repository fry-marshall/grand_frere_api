import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Item } from '../items/entities/item.entity';
import { Student } from '../students/entities/student.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../wallets/entities/transaction.entity';
import { Card } from '../cards/entities/card.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Item,
      Student,
      Vendor,
      Wallet,
      Transaction,
      Card,
      Parent,
      StudentParent,
      User,
      VendorWallet,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
