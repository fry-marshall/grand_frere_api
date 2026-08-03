import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ReplaceCardDto {
  @ApiProperty({
    description:
      'Code of the blank, unassigned card to activate as the replacement',
    example: 'GF-LMC-0042',
  })
  @IsString()
  @MinLength(1)
  newCardCode: string;
}
