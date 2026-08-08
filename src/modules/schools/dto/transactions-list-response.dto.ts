import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SchoolTransactionResponseDto } from './school-transaction-response.dto';

class TransactionsStatsDto {
  @ApiProperty()
  totalTransactions: number;

  @ApiProperty({ description: 'Sum of CREDIT transaction amounts' })
  totalCredits: number;

  @ApiProperty({ description: 'Sum of DEBIT transaction amounts' })
  totalDebits: number;

  @ApiPropertyOptional({
    description:
      'Count of CREDIT transactions (wallet recharges). Only present on GET /transactions.',
  })
  rechargeCount?: number;
}

class TransactionsListDto {
  @ApiProperty({ type: [SchoolTransactionResponseDto] })
  data: SchoolTransactionResponseDto[];

  @ApiProperty()
  meta: object;
}

export class TransactionsListResponseDto {
  @ApiProperty({ type: TransactionsListDto })
  transactions: TransactionsListDto;

  @ApiProperty({ type: TransactionsStatsDto })
  stats: TransactionsStatsDto;
}
