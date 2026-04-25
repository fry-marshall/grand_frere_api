import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Card } from '../cards/entities/card.entity';
import { Student } from '../students/entities/student.entity';
import { StudentParent } from '../students/entities/student-parent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Card, Student, StudentParent])],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
