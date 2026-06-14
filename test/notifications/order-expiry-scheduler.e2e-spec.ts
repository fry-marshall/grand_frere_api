import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { OrderExpiryScheduler } from '../../src/modules/notifications/schedulers/order-expiry.scheduler';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';
import { NotificationType } from '../../src/modules/notifications/notification.types';

describe('OrderExpiryScheduler', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let vendorRepo: Repository<Vendor>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;
  let notificationRepo: Repository<Notification>;
  let scheduler: OrderExpiryScheduler;

  let school: School;
  let studentUser: User;
  let student: Student;
  let vendor: Vendor;
  let wallet: Wallet;

  const pastDate = new Date(Date.now() - 60 * 60 * 1000);

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    vendorRepo = ds.getRepository(Vendor);
    walletRepo = ds.getRepository(Wallet);
    transactionRepo = ds.getRepository(Transaction);
    orderRepo = ds.getRepository(Order);
    notificationRepo = ds.getRepository(Notification);
    scheduler = moduleRef.get(OrderExpiryScheduler);

    for (const sigle of ['TS-EX']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) await vendorRepo.delete({ id: v.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of ['+2250100006300', '+2250100006301']) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Expiry',
      sigle: 'TS-EX',
      address: '1 EX St',
      status: SchoolStatus.ACTIVE,
    });

    studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'EX',
      phone: '+2250100006300',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '6ème A',
    });
    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 10000,
      reserved: 5000,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'EX',
      phone: '+2250100006301',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack EX',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await notificationRepo.delete({ userId: studentUser.id });
    await transactionRepo.delete({ walletId: wallet.id });
    await orderRepo.delete({ studentId: student.id });
    await walletRepo.delete({ studentId: student.id });
    await studentRepo.delete({ userId: studentUser.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ phone: '+2250100006300' });
    await userRepo.delete({ phone: '+2250100006301' });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should expire PENDING orders with past expiresAt and release wallet reserved', async () => {
      const order = await orderRepo.save({
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.PENDING,
        totalAmount: 2000,
        expiresAt: pastDate,
        scheduledFor: new Date().toISOString().slice(0, 10),
      });

      await scheduler.expireOrders();

      const updatedOrder = await orderRepo.findOne({ where: { id: order.id } });
      expect(updatedOrder!.status).toBe(OrderStatus.EXPIRED);

      const updatedWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(updatedWallet!.reserved).toBe(3000);

      const releaseTransaction = await transactionRepo.findOne({
        where: { orderId: order.id },
      });
      expect(releaseTransaction).toBeDefined();
      expect(releaseTransaction!.amount).toBe(2000);
    });

    it('should create ORDER_EXPIRED notification for the student', async () => {
      const order = await orderRepo.save({
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.PENDING,
        totalAmount: 1000,
        expiresAt: pastDate,
        scheduledFor: new Date().toISOString().slice(0, 10),
      });

      await scheduler.expireOrders();

      const notifications = await notificationRepo.find({
        where: { userId: studentUser.id, type: NotificationType.ORDER_EXPIRED },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(1);

      await orderRepo.delete({ id: order.id });
    });

    it('should not expire PENDING orders with future expiresAt', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const order = await orderRepo.save({
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.PENDING,
        totalAmount: 500,
        expiresAt: futureDate,
        scheduledFor: new Date().toISOString().slice(0, 10),
      });

      await scheduler.expireOrders();

      const unchangedOrder = await orderRepo.findOne({
        where: { id: order.id },
      });
      expect(unchangedOrder!.status).toBe(OrderStatus.PENDING);

      await orderRepo.delete({ id: order.id });
    });

    it('should not expire already EXPIRED orders', async () => {
      const order = await orderRepo.save({
        studentId: student.id,
        vendorId: vendor.id,
        status: OrderStatus.EXPIRED,
        totalAmount: 1000,
        expiresAt: pastDate,
        scheduledFor: new Date().toISOString().slice(0, 10),
      });

      const walletBefore = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      const reservedBefore = walletBefore!.reserved;

      await scheduler.expireOrders();

      const walletAfter = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(walletAfter!.reserved).toBe(reservedBefore);

      await orderRepo.delete({ id: order.id });
    });
  });
});
