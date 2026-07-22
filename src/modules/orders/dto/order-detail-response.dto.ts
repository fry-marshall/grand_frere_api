import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../order.types';

export class OrderItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  itemId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description: string | null;

  @ApiPropertyOptional()
  imageUrl: string | null;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;
}

export class OrderDetailResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  shortCode: string | null;
  expiresAt: Date;
  createdAt: Date;
  vendor?: {
    id: string;
    shopName: string;
    waveNumber: string;
    phone?: string;
  };
  student?: {
    id: string;
    class: string | null;
    user: { id: string; firstName: string; lastName: string };
  };
  items: OrderItemResponseDto[];
}
