import { ApiProperty } from '@nestjs/swagger';

export class SchoolStudentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  class: string;

  @ApiProperty({ nullable: true })
  cardId: string;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
