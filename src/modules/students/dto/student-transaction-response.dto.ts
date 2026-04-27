import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '../../wallets/wallet.types';
import { Currency } from '../../../common/enums/currency.enum';

export class StudentTransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  balanceBefore: number;

  @ApiProperty()
  balanceAfter: number;

  @ApiProperty({ nullable: true })
  orderId: string;

  @ApiProperty({ nullable: true })
  paymentId: string;

  @ApiProperty()
  createdAt: Date;
}
