import { ApiProperty } from '@nestjs/swagger';
import { CardStatus } from '../../cards/card.types';

export class ScanCardResponseDto {
  @ApiProperty({ enum: CardStatus, example: CardStatus.UNASSIGNED })
  status: CardStatus;

  @ApiProperty({ example: false })
  student: boolean;

  @ApiProperty({ example: [false, false], type: [Boolean] })
  parents: [boolean, boolean];
}
