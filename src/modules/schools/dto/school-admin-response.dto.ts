import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/user.types';

export class SchoolAdminResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({
    example: 'aB3xR9mK2pQz',
    description:
      'Auto-generated password, only present in the create/approve response — never returned again afterwards.',
  })
  password?: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  phone: string;

  @ApiProperty({ enum: UserRole })
  role: UserRole;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  createdAt: Date;
}
