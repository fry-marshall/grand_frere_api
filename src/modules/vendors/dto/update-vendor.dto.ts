import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVendorDto {
  @ApiPropertyOptional({ example: 'Snack du Coin' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  shopName?: string;

  @ApiPropertyOptional({ example: '+2250707000001' })
  @IsOptional()
  @IsString()
  waveNumber?: string;
}
