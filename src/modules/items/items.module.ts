import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Item, Vendor, User])],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
