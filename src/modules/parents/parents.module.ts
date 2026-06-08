import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { Parent } from './entities/parent.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Card } from '../cards/entities/card.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Wallet } from '../wallets/entities/wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Parent,
      User,
      Student,
      Card,
      StudentParent,
      Wallet,
    ]),
  ],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
