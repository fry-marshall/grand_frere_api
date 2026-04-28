import { OrderStatus } from '../order.types';

export class OrderItemResponseDto {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
}

export class OrderDetailResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  items: OrderItemResponseDto[];
}
