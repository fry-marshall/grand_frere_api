import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../../common/enums/currency.enum';
import { WithdrawalStatus } from '../withdrawal.types';

export class WithdrawalListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty()
  waveNumber: string;

  @ApiPropertyOptional()
  paystackRef: string | null;

  @ApiProperty({ enum: WithdrawalStatus })
  status: WithdrawalStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  vendor: {
    id: string;
    shopName: string;
  };

  @ApiProperty()
  school: {
    id: string;
    name: string;
  };
}
