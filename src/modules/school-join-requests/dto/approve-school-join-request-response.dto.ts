import { ApiProperty } from '@nestjs/swagger';
import { SchoolResponseDto } from '../../schools/dto/school-response.dto';
import { SchoolAdminResponseDto } from '../../schools/dto/school-admin-response.dto';

export class ApproveSchoolJoinRequestResponseDto {
  @ApiProperty({ type: SchoolResponseDto })
  school: SchoolResponseDto;

  @ApiProperty({ type: SchoolAdminResponseDto })
  admin: SchoolAdminResponseDto;
}
