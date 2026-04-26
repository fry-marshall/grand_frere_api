import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class CreateCardsBatchDto {
  @ApiProperty({ example: 'uuid-of-school' })
  @IsUUID()
  schoolId: string;

  @ApiProperty({ example: 20, minimum: 1, maximum: 100 })
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;
}
