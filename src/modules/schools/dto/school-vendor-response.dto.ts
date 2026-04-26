import { ApiProperty } from '@nestjs/swagger';
import { VendorStatus } from '../../vendors/vendor.types';

export class SchoolVendorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  shopName: string;

  @ApiProperty({ nullable: true })
  waveNumber: string;

  @ApiProperty({ enum: VendorStatus })
  status: VendorStatus;

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
