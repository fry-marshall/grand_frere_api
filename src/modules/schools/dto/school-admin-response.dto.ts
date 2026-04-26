import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/user.types';

export class SchoolAdminResponseDto {
  @ApiProperty()
  id: string;

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
