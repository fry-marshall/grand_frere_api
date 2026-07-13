import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolJoinRequestStatus } from '../school-join-request.types';

export class SchoolJoinRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty()
  sigle: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  contactFirstName: string;

  @ApiProperty()
  contactLastName: string;

  @ApiProperty()
  contactPhone: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiProperty({ enum: SchoolJoinRequestStatus })
  status: SchoolJoinRequestStatus;

  @ApiPropertyOptional()
  rejectionReason?: string;

  @ApiProperty()
  createdAt: Date;
}
