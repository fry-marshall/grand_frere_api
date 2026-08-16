import { ApiProperty } from '@nestjs/swagger';

export class ParentStudentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  class: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  schoolName: string;

  @ApiProperty({
    description: 'Wallet balance, 0 if the student has no card yet',
  })
  balance: number;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
  };

  @ApiProperty({ nullable: true })
  card: {
    code: string;
    dailyLimit: number;
  } | null;
}
