import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CreateOrderItemDto } from './create-order-item.dto';
import { PaymentMethod } from '../order.types';

export class CreateOrderDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({
    enum: PaymentMethod,
    default: PaymentMethod.WALLET,
    description: 'Payment method. Defaults to WALLET.',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    example: '2026-06-16',
    description: 'Scheduled date for the order (Mon–Fri). Defaults to today.',
  })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
