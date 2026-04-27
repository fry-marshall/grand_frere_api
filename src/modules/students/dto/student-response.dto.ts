import { ApiProperty } from '@nestjs/swagger';

export class StudentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  class: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };

  @ApiProperty({ nullable: true })
  card: {
    id: string;
    code: string;
  } | null;
}
