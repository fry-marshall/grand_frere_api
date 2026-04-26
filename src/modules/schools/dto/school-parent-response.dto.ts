import { ApiProperty } from '@nestjs/swagger';

export class SchoolParentResponseDto {
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
