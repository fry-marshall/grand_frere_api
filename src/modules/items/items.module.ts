import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Item, Vendor]), NotificationsModule],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
