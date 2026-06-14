import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class AddBeneficiaryDto {
  @ApiPropertyOptional({ example: 'GF-2024-001' })
  @IsString()
  @IsNotEmpty()
  cardCode: string;

  @ApiPropertyOptional({
    description: '4-digit card PIN (required for UNASSIGNED cards)',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;

  @ApiPropertyOptional({ example: 'Akissi' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kouamé' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @ApiPropertyOptional({ example: 'CM2' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  class?: string;
}
