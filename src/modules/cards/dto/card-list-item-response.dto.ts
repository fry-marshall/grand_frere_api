import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CardStatus } from '../card.types';

export class CardListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ enum: CardStatus })
  status: CardStatus;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiPropertyOptional()
  studentId: string | null;

  @ApiPropertyOptional({ description: 'null when the card is not assigned' })
  studentName: string | null;

  @ApiProperty()
  createdAt: Date;
}
