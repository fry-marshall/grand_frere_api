import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolJoinRequestStatus } from '../school-join-request.types';
import { Gender } from '../../users/user.types';

export class SchoolJoinRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  studentCount: number;

  @ApiProperty({ enum: Gender })
  gender: Gender;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  position: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty({ enum: SchoolJoinRequestStatus })
  status: SchoolJoinRequestStatus;

  @ApiPropertyOptional()
  rejectionReason?: string;

  @ApiProperty()
  createdAt: Date;
}
