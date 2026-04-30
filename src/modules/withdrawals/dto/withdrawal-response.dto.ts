import { Currency } from '../../../common/enums/currency.enum';
import { WithdrawalStatus } from '../withdrawal.types';

export class WithdrawalResponseDto {
  id: string;
  vendorId: string;
  amount: number;
  currency: Currency;
  waveNumber: string;
  paystackRef: string | null;
  status: WithdrawalStatus;
  createdAt: Date;
}
