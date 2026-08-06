import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '../../users/user.types';

export class ParentListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty()
  childrenCount: number;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
