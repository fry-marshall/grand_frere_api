import { ApiProperty } from '@nestjs/swagger';

export class SchoolStatsResponseDto {
  @ApiProperty()
  schoolId: string;

  @ApiProperty({ description: 'Sum of completed order amounts (revenue)' })
  revenue: number;

  @ApiProperty({ description: 'Number of completed orders' })
  volume: number;

  @ApiProperty()
  studentsCount: number;

  @ApiProperty({ description: 'Count of students with a validated account' })
  activeStudentsCount: number;

  @ApiProperty()
  vendorsCount: number;

  @ApiProperty({ description: 'Count of vendors with ACTIVE status' })
  activeVendorsCount: number;

  @ApiProperty()
  parentsCount: number;
}
