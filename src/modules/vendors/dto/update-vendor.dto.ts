import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    example: '08:00',
    description: 'Opening time (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'openingTime must be in HH:mm format' })
  openingTime?: string;

  @ApiPropertyOptional({
    example: '17:00',
    description: 'Closing time (HH:mm)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'closingTime must be in HH:mm format' })
  closingTime?: string;
}
