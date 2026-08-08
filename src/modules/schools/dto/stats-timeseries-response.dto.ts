import { ApiProperty } from '@nestjs/swagger';

class StatsTimeseriesBucketDto {
  @ApiProperty({
    description: 'Short display label for the bucket, e.g. "08/08" or "Août"',
  })
  label: string;

  @ApiProperty({ description: 'Sum of completed order amounts in this bucket' })
  revenue: number;

  @ApiProperty({ description: 'Number of completed orders in this bucket' })
  volume: number;
}

export class StatsTimeseriesResponseDto {
  @ApiProperty({ type: [StatsTimeseriesBucketDto] })
  buckets: StatsTimeseriesBucketDto[];
}
