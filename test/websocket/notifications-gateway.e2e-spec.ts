import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrderItem } from '../../src/modules/orders/entities/order-item.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import {
  OrderStatus,
  PaymentMethod,
} from '../../src/modules/orders/order.types';
import { CardStatus } from '../../src/modules/cards/card.types';
import { NotificationsGateway } from '../../src/modules/notifications/notifications.gateway';

const connectSocket = (port: number, token: string): Socket =>
  io(`http://localhost:${port}`, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
  });

const waitForEvent = <T>(socket: Socket, event: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${event}`)),
      3000,
    );
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

describe('NotificationsGateway (WebSocket)', () => {
  let app: INestApplication;
  let port: number;
  let jwtService: JwtService;

  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let itemRepo: Repository<Item>;
  let cardRepo: Repository<Card>;
  let transactionRepo: Repository<Transaction>;

  let school: School;
  let vendor: Vendor;
  let student: Student;
  let item: Item;
  let vendorToken: string;
  let studentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;
    await app.listen(0);
    const addr = getServer(app).address();
    port = typeof addr === 'object' && addr ? addr.port : 3001;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    orderItemRepo = ds.getRepository(OrderItem);
    itemRepo = ds.getRepository(Item);
    cardRepo = ds.getRepository(Card);
    transactionRepo = ds.getRepository(Transaction);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-WS' } });
    if (leftover) {
      const leftStudents = await studentRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const s of leftStudents) {
        const lw = await walletRepo.findOne({ where: { studentId: s.id } });
        if (lw) {
          await transactionRepo.delete({ walletId: lw.id });
          await orderRepo.delete({ studentId: s.id });
          await walletRepo.delete({ id: lw.id });
        }
      }
      const leftVendors = await vendorRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const v of leftVendors) {
        await itemRepo.delete({ vendorId: v.id });
        await vendorRepo.delete({ id: v.id });
      }
      await cardRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    for (const phone of ['+2250100008000', '+2250100008001']) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'Test School WS',
      sigle: 'TS-WS',
      address: '1 Rue WS, Abidjan',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'WS',
      phone: '+2250100008000',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Shop WS',
      status: VendorStatus.ACTIVE,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: UserRole.VENDOR,
    });

    const card = await cardRepo.save({
      code: 'TS-WS-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'WS',
      phone: '+2250100008001',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      cardId: card.id,
      schoolId: school.id,
    });
    await cardRepo.update(card.id, { studentId: student.id });
    await walletRepo.save({
      studentId: student.id,
      balance: 5000,
      reserved: 0,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Attiéké WS',
      price: 500,
      status: ItemStatus.ACTIVE,
    });

    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: UserRole.STUDENT,
    });
  });

  afterAll(async () => {
    const students = await studentRepo.find({ where: { schoolId: school.id } });
    for (const s of students) {
      const lw = await walletRepo.findOne({ where: { studentId: s.id } });
      if (lw) {
        await transactionRepo.delete({ walletId: lw.id });
        await orderRepo.delete({ studentId: s.id });
        await walletRepo.delete({ id: lw.id });
      }
    }
    await itemRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ id: vendor.id });
    await cardRepo.delete({ schoolId: school.id });
    for (const phone of ['+2250100008000', '+2250100008001']) {
      await userRepo.delete({ phone });
    }
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should accept connection with a valid JWT', (done) => {
      const socket = connectSocket(port, vendorToken);
      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        done();
      });
      socket.on('connect_error', (err) => {
        socket.disconnect();
        done(err);
      });
    });

    it('should emit order.created to vendor room when an order is created', async () => {
      const vendorSocket = connectSocket(port, vendorToken);
      await new Promise<void>((res) => vendorSocket.on('connect', () => res()));

      const orderPromise = waitForEvent<{ id: string; vendorId: string }>(
        vendorSocket,
        'order.created',
      );

      const savedOrder = await orderRepo.save({
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.PENDING,
        totalAmount: 500,
        expiresAt: new Date(Date.now() + 900_000),
      });
      await orderItemRepo.save({
        orderId: savedOrder.id,
        itemId: item.id,
        quantity: 1,
        unitPrice: 500,
      });

      const gateway = app.get(NotificationsGateway);
      gateway.emitOrderCreated(vendor.id, {
        id: savedOrder.id,
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 500,
        expiresAt: savedOrder.expiresAt,
        createdAt: savedOrder.createdAt,
      });

      const received = await orderPromise;
      expect(received.id).toBe(savedOrder.id);
      expect(received.vendorId).toBe(vendor.id);

      vendorSocket.disconnect();
      await orderRepo.delete({ id: savedOrder.id });
    });

    it('should emit order.updated to student room when order status changes', async () => {
      const studentSocket = connectSocket(port, studentToken);
      await new Promise<void>((res) =>
        studentSocket.on('connect', () => res()),
      );

      const updatePromise = waitForEvent<{ id: string; status: string }>(
        studentSocket,
        'order.updated',
      );

      const savedOrder = await orderRepo.save({
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.VALIDATED,
        totalAmount: 500,
        expiresAt: new Date(Date.now() + 900_000),
      });

      const gateway = app.get(NotificationsGateway);

      const studentUser = await userRepo.findOne({
        where: { id: student.userId },
      });
      gateway.emitOrderUpdated([studentUser!.id], {
        id: savedOrder.id,
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.VALIDATED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 500,
        expiresAt: savedOrder.expiresAt,
        createdAt: savedOrder.createdAt,
      });

      const received = await updatePromise;
      expect(received.id).toBe(savedOrder.id);
      expect(received.status).toBe(OrderStatus.VALIDATED);

      studentSocket.disconnect();
      await orderRepo.delete({ id: savedOrder.id });
    });
  });

  describe('Failure cases', () => {
    it('should disconnect a client with an invalid token', (done) => {
      const socket = connectSocket(port, 'invalid.token.here');
      socket.on('disconnect', () => {
        done();
      });
      socket.on('connect_error', () => {
        socket.disconnect();
        done();
      });
      setTimeout(() => {
        if (!socket.connected) done();
        else {
          socket.disconnect();
          done(new Error('Should have been rejected'));
        }
      }, 1500);
    });
  });
});
