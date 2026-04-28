import { OrderStatus } from '../order.types';

export class OrderResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
}
