import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class StudentsSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Kouassi',
    description: "Matches the student's name (case-insensitive, partial)",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ example: 'CM1' })
  @IsOptional()
  @IsString()
  class?: string;
}
