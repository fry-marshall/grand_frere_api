import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { CardTemplate } from '../card.types';

export class CreateCardsBatchDto {
  @ApiProperty({ example: 'uuid-of-school' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;

  @ApiProperty({ enum: CardTemplate, example: CardTemplate.LUFFY })
  @IsEnum(CardTemplate)
  template: CardTemplate;
}
