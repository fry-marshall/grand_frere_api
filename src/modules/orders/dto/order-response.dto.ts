import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../order.types';

class OrderResponseVendorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  shopName: string;
}

export class OrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  vendorId: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ nullable: true })
  shortCode: string | null;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  scheduledFor: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ type: OrderResponseVendorDto })
  vendor?: OrderResponseVendorDto;
}
