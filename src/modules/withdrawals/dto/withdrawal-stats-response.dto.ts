import { ApiProperty } from '@nestjs/swagger';
import { WithdrawalStatus } from '../withdrawal.types';

class WithdrawalStatusStatsDto {
  @ApiProperty({ enum: WithdrawalStatus })
  status: WithdrawalStatus;

  @ApiProperty()
  count: number;

  @ApiProperty()
  amount: number;
}

export class WithdrawalStatsResponseDto {
  @ApiProperty({
    type: [WithdrawalStatusStatsDto],
    description: 'Count and total amount of withdrawals, grouped by status',
  })
  byStatus: WithdrawalStatusStatsDto[];
}
