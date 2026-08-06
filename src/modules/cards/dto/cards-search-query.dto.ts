import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CardStatus } from '../card.types';

export class CardsSearchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @ApiPropertyOptional({ enum: CardStatus })
  @IsOptional()
  @IsEnum(CardStatus)
  status?: CardStatus;

  @ApiPropertyOptional({
    example: 'LMC-000',
    description: 'Matches the card code (case-insensitive, partial)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
