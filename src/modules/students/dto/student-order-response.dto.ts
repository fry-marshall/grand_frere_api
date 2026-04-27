import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../orders/order.types';

export class StudentOrderResponseDto {
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
  vendor: {
    id: string;
    shopName: string;
  };
}
