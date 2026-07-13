import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolJoinRequestsController } from './school-join-requests.controller';
import { SchoolJoinRequestsService } from './school-join-requests.service';
import { SchoolJoinRequest } from './entities/school-join-request.entity';
import { School } from '../schools/entities/school.entity';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolJoinRequest, School]),
    SchoolsModule,
  ],
  controllers: [SchoolJoinRequestsController],
  providers: [SchoolJoinRequestsService],
})
export class SchoolJoinRequestsModule {}
