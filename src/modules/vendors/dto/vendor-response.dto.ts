import { ApiProperty } from '@nestjs/swagger';
import { VendorStatus } from '../vendor.types';

export class VendorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  shopName: string;

  @ApiProperty({ nullable: true })
  waveNumber: string;

  @ApiProperty({ enum: VendorStatus })
  status: VendorStatus;

  @ApiProperty()
  schoolId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  user: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
}
