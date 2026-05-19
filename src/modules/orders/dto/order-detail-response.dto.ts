import { OrderStatus, PaymentMethod } from '../order.types';

export class OrderItemResponseDto {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  item?: { name: string };
}

export class OrderDetailResponseDto {
  id: string;
  studentId: string;
  vendorId: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  expiresAt: Date;
  createdAt: Date;
  vendor?: { id: string; shopName: string; waveNumber: string };
  student?: { user: { firstName: string; lastName: string } };
  items: OrderItemResponseDto[];
}
