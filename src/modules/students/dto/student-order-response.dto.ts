import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../../orders/order.types';

class StudentOrderItemDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;
}

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

  @ApiProperty({ type: [StudentOrderItemDto] })
  items: StudentOrderItemDto[];

  @ApiProperty()
  vendor: {
    id: string;
    shopName: string;
  };
}
