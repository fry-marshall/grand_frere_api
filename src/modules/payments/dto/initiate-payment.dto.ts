import { IsInt, IsUUID, Min } from 'class-validator';

export class InitiatePaymentDto {
  @IsUUID()
  studentId: string;

  @IsInt()
  @Min(100)
  amount: number;
}
