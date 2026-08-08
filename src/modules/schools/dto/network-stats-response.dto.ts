import { ApiProperty } from '@nestjs/swagger';
import { SchoolStatus } from '../school.types';

export class SchoolStatsBreakdownDto {
  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  sigle: string;

  @ApiProperty({ enum: SchoolStatus })
  status: SchoolStatus;

  @ApiProperty({ description: 'Sum of completed order amounts (revenue)' })
  revenue: number;

  @ApiProperty({ description: 'Number of completed orders' })
  volume: number;
}

export class NetworkStatsResponseDto {
  @ApiProperty({ description: 'Network-wide sum of completed order amounts' })
  totalRevenue: number;

  @ApiProperty({ description: 'Network-wide number of completed orders' })
  orderVolume: number;

  @ApiProperty({ description: 'Count of students with a validated account' })
  activeStudentsCount: number;

  @ApiProperty()
  activeSchoolsCount: number;

  @ApiProperty()
  suspendedSchoolsCount: number;

  @ApiProperty({ type: [SchoolStatsBreakdownDto] })
  schools: SchoolStatsBreakdownDto[];
}
