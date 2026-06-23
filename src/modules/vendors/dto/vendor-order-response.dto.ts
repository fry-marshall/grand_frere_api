import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod } from '../../orders/order.types';

export class VendorOrderItemDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;
}

export class VendorOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  scheduledFor: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: [VendorOrderItemDto] })
  items: VendorOrderItemDto[];

  @ApiProperty()
  student: {
    id: string;
    class: string;
    user: { id: string; firstName: string; lastName: string };
  };
}
