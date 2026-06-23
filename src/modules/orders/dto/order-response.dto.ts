import { OrderStatus, PaymentMethod } from '../order.types';

export class OrderResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  shortCode: string | null;
  expiresAt: Date;
  scheduledFor: string;
  createdAt: Date;
}
