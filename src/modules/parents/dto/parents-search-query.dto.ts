import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ParentsSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Aminata',
    description: "Matches the parent's name (case-insensitive, partial)",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Only parents with at least one child enrolled in this school',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
