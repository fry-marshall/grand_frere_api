import { ApiProperty } from '@nestjs/swagger';

export class SchoolParentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({
    description: "Number of the parent's children enrolled in this school",
  })
  childrenCount: number;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
