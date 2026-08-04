import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '2025-01-01T00:00:00Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    description:
      'Optional school filter. Omitted = all schools for SUPER_ADMIN, auto-scoped to own school for SCHOOL_ADMIN.',
  })
  @IsOptional()
  @IsUUID()
  schoolId?: string;
}
