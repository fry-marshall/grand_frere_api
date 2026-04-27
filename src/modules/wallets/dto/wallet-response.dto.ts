import { Currency } from '../../../common/enums/currency.enum';

export class WalletResponseDto {
  id: string;
  studentId: string;
  balance: number;
  reserved: number;
  currency: Currency;
}
