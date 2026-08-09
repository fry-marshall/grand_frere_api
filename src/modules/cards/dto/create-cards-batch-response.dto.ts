import { ApiProperty } from '@nestjs/swagger';
import { CardTemplate } from '../card.types';
import { CardResponseDto } from './card-response.dto';

export class CreateCardsBatchResponseDto {
  @ApiProperty()
  batchId: string;

  @ApiProperty({ enum: CardTemplate })
  template: CardTemplate;

  @ApiProperty({ type: [CardResponseDto] })
  cards: CardResponseDto[];
}
