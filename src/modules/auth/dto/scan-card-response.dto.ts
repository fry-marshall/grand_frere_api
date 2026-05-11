import { ApiProperty } from '@nestjs/swagger';
import { CardStatus } from '../../cards/card.types';

export class ScanCardResponseDto {
  @ApiProperty({ enum: CardStatus, example: CardStatus.UNASSIGNED })
  status: CardStatus;

  @ApiProperty({ example: false })
  student: boolean;

  @ApiProperty({
    example: true,
    description:
      'True when the student has no own account yet (card unassigned, or student created by a parent without self-registering)',
  })
  requiresStudentInfo: boolean;

  @ApiProperty({ example: [false, false], type: [Boolean] })
  parents: [boolean, boolean];
}
