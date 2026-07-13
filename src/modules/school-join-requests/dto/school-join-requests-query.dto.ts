import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SchoolJoinRequestStatus } from '../school-join-request.types';

export class SchoolJoinRequestsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SchoolJoinRequestStatus })
  @IsOptional()
  @IsEnum(SchoolJoinRequestStatus)
  status?: SchoolJoinRequestStatus;
}
