import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolActivitiesController } from './school-activities.controller';
import { SchoolActivitiesService } from './school-activities.service';
import { SchoolActivity } from './entities/school-activity.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SchoolActivity, School, User])],
  controllers: [SchoolActivitiesController],
  providers: [SchoolActivitiesService],
})
export class SchoolActivitiesModule {}
