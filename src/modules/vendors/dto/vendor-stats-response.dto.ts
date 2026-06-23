import { ApiProperty } from '@nestjs/swagger';

export class VendorStatsResponseDto {
  @ApiProperty()
  todayOrderCount: number;

  @ApiProperty()
  todayRevenue: number;

  @ApiProperty()
  cashToCollect: number;
}
