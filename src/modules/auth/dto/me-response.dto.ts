import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/user.types';

export class MeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Aminata' })
  firstName: string;

  @ApiProperty({ example: 'Koné' })
  lastName: string;

  @ApiProperty({ example: '+22501000000' })
  phone: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiPropertyOptional()
  schoolId: string | null;

  @ApiPropertyOptional({ example: 'Lycée Cocody Angré' })
  schoolName: string | null;
}
