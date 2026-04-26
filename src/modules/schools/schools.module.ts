import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School } from './entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([School, User, Vendor])],
  controllers: [SchoolsController],
  providers: [SchoolsService],
})
export class SchoolsModule {}
