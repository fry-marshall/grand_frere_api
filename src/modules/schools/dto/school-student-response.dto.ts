import { ApiProperty } from '@nestjs/swagger';
import { CardStatus } from '../../cards/card.types';

export class SchoolStudentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  class: string;

  @ApiProperty({ nullable: true })
  cardId: string;

  @ApiProperty({ nullable: true })
  cardCode: string | null;

  @ApiProperty({ enum: CardStatus, nullable: true })
  cardStatus: CardStatus | null;

  @ApiProperty({
    description: 'Wallet balance, 0 if the student has no card yet',
  })
  balance: number;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
