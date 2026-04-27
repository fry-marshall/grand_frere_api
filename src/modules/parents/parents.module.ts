import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentsController } from './parents.controller';
import { ParentsService } from './parents.service';
import { Parent } from './entities/parent.entity';
import { User } from '../users/entities/user.entity';
import { StudentParent } from '../students/entities/student-parent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Parent, User, StudentParent])],
  controllers: [ParentsController],
  providers: [ParentsService],
})
export class ParentsModule {}
