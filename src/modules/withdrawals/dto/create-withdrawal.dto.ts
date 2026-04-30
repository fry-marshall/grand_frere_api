import { IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateWithdrawalDto {
  @IsInt()
  @Min(100)
  amount: number;

  @IsString()
  @MinLength(3)
  waveNumber: string;
}
