import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '../../withdrawals/withdrawal.types';
import { Currency } from '../../../common/enums/currency.enum';

export class VendorWithdrawalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: WithdrawalStatus })
  status: WithdrawalStatus;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  waveNumber: string;

  @ApiProperty({ nullable: true })
  paystackRef: string;

  @ApiProperty()
  createdAt: Date;
}
