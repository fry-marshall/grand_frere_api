import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { SchoolStatus } from '../school.types';

export class SchoolsSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Cocody',
    description: 'Matches school name or sigle (case-insensitive, partial)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: SchoolStatus })
  @IsOptional()
  @IsEnum(SchoolStatus)
  status?: SchoolStatus;
}
