import { ApiProperty } from '@nestjs/swagger';

export class StudentParentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
