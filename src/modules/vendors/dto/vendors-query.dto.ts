import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { VendorStatus } from '../vendor.types';

export class VendorsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'Snack',
    description: 'Matches the shop name (case-insensitive, partial)',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: VendorStatus })
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;
}
