import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '../../../common/enums/currency.enum';

export class VendorBalanceResponseDto {
  @ApiProperty()
  vendorId: string;

  @ApiProperty()
  balance: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  updatedAt: Date;
}
