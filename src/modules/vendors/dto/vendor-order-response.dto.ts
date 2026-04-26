import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../orders/order.types';

export class VendorOrderResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  student: {
    id: string;
    class: string;
    user: { id: string; firstName: string; lastName: string };
  };
}
