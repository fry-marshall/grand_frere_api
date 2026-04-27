import { Currency } from '../../../common/enums/currency.enum';
import { PaymentStatus } from '../payment.types';

export class PaymentResponseDto {
  id: string;
  walletId: string;
  paystackRef: string;
  amount: number;
  currency: Currency;
  status: PaymentStatus;
  initiatedBy: string;
  createdAt: Date;
}
