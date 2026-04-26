import { ApiProperty } from '@nestjs/swagger';
import { SchoolStatus } from '../school.types';

export class SchoolResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  sigle: string;

  @ApiProperty()
  address: string;

  @ApiProperty({ enum: SchoolStatus })
  status: SchoolStatus;

  @ApiProperty()
  createdAt: Date;
}
