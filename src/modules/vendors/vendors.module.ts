import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';
import { Vendor } from './entities/vendor.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { Item } from '../items/entities/item.entity';
import { Withdrawal } from '../withdrawals/entities/withdrawal.entity';
import { VendorWallet } from './entities/vendor-wallet.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vendor,
      User,
      Order,
      Student,
      Parent,
      Item,
      Withdrawal,
      VendorWallet,
    ]),
    NotificationsModule,
  ],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
