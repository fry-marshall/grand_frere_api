import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AddBeneficiaryDto {
  @ApiProperty({ example: 'GF-2024-001' })
  @IsString()
  @IsNotEmpty()
  cardCode: string;
}
