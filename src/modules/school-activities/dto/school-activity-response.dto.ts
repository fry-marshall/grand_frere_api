import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SchoolActivitySchoolDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  sigle: string;
}

export class SchoolActivityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ type: [String] })
  photoUrls: string[];

  @ApiProperty()
  isVisible: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: SchoolActivitySchoolDto })
  school?: SchoolActivitySchoolDto;
}
