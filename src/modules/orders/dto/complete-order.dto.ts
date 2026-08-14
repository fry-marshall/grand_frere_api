import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CompleteOrderDto {
  @ApiPropertyOptional({
    description:
      "Student's card PIN, required to confirm the cashin in person when " +
      'completed by a VENDOR. Not required for a SUPER_ADMIN override.',
    example: '1234',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin?: string;
}
