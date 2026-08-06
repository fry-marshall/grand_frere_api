import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AssignCardDto {
  @ApiProperty({
    description: 'Code of the unassigned card to assign to the student',
    example: 'GF-LMC-0042',
  })
  @IsString()
  @MinLength(1)
  cardCode: string;
}
