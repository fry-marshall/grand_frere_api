import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardStatus } from '../card.types';

export class CardResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ enum: CardStatus })
  status: CardStatus;

  @ApiProperty()
  schoolId: string;

  @ApiPropertyOptional()
  studentId: string | null;

  @ApiProperty()
  dailyLimit: number;

  @ApiPropertyOptional()
  imageUrl: string | null;

  @ApiProperty()
  createdAt: Date;
}
