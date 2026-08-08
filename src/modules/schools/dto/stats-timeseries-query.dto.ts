import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StatsGranularity } from '../school.types';

export class StatsTimeseriesQueryDto {
  @ApiPropertyOptional({
    enum: StatsGranularity,
    default: StatsGranularity.DAY,
  })
  @IsOptional()
  @IsEnum(StatsGranularity)
  granularity: StatsGranularity = StatsGranularity.DAY;

  @ApiPropertyOptional({
    description:
      'Omit for network-wide stats, or provide to scope to a single school.',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
