import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { Card } from './entities/card.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Card, School, User])],
  controllers: [CardsController],
  providers: [CardsService],
})
export class CardsModule {}
