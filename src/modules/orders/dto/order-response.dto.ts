import { OrderStatus, PaymentMethod } from '../order.types';

export class OrderResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
}
