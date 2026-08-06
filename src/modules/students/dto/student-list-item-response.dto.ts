import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../users/user.types';
import { CardStatus } from '../../cards/card.types';

export class StudentListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  class: string;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty({
    description: 'Wallet balance, 0 if the student has no card yet',
  })
  balance: number;

  @ApiProperty({ nullable: true })
  cardCode: string | null;

  @ApiProperty({ enum: CardStatus, nullable: true })
  cardStatus: CardStatus | null;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
