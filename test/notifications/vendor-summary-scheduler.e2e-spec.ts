import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrderItem } from '../../src/modules/orders/entities/order-item.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { VendorSummaryScheduler } from '../../src/modules/notifications/schedulers/vendor-summary.scheduler';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import { NotificationType } from '../../src/modules/notifications/notification.types';

describe('VendorSummaryScheduler', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let vendorRepo: Repository<Vendor>;
  let walletRepo: Repository<Wallet>;
  let itemRepo: Repository<Item>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let notificationRepo: Repository<Notification>;
  let scheduler: VendorSummaryScheduler;

  let school: School;
  let vendorUser: User;
  let vendor: Vendor;
  let studentUser: User;
  let student: Student;
  let item: Item;

  const tomorrow = new Date();

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    vendorRepo = ds.getRepository(Vendor);
    walletRepo = ds.getRepository(Wallet);
    itemRepo = ds.getRepository(Item);
    orderRepo = ds.getRepository(Order);
    orderItemRepo = ds.getRepository(OrderItem);
    notificationRepo = ds.getRepository(Notification);
    scheduler = moduleRef.get(VendorSummaryScheduler);

    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);

    for (const sigle of ['TS-VS']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) {
          await orderItemRepo.delete({ order: { vendorId: v.id } });
          await orderRepo.delete({ vendorId: v.id });
          await itemRepo.delete({ vendorId: v.id });
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of ['+2250100006400', '+2250100006401']) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Vendor Summary',
      sigle: 'TS-VS',
      address: '1 VS St',
      status: SchoolStatus.ACTIVE,
    });

    vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'VS',
      phone: '+2250100006400',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack VS',
      status: VendorStatus.ACTIVE,
    });

    studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'VS',
      phone: '+2250100006401',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '5ème B',
    });
    await walletRepo.save({
      studentId: student.id,
      balance: 50000,
      reserved: 0,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Riz sauce',
      price: 1000,
      status: ItemStatus.ACTIVE,
    });

    const order = await orderRepo.save({
      studentId: student.id,
      vendorId: vendor.id,
      status: OrderStatus.PENDING,
      totalAmount: 3000,
      expiresAt: tomorrow,
      scheduledFor: new Date().toISOString().slice(0, 10),
    });
    await orderItemRepo.save({
      orderId: order.id,
      itemId: item.id,
      quantity: 3,
      unitPrice: 1000,
    });
  });

  afterAll(async () => {
    await notificationRepo.delete({ userId: vendorUser.id });
    const orders = await orderRepo.find({ where: { vendorId: vendor.id } });
    for (const o of orders) await orderItemRepo.delete({ orderId: o.id });
    await orderRepo.delete({ vendorId: vendor.id });
    await itemRepo.delete({ vendorId: vendor.id });
    await walletRepo.delete({ studentId: student.id });
    await studentRepo.delete({ userId: studentUser.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ phone: '+2250100006400' });
    await userRepo.delete({ phone: '+2250100006401' });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should send a VENDOR_SUMMARY notification to the vendor with tomorrow orders', async () => {
      await scheduler.sendVendorSummaries();

      const notifications = await notificationRepo.find({
        where: { userId: vendorUser.id, type: NotificationType.VENDOR_SUMMARY },
      });
      expect(notifications.length).toBeGreaterThanOrEqual(1);
      expect(notifications[0].body).toContain('Riz sauce');
    });

    it('should not send a notification for a vendor with no orders tomorrow', async () => {
      const emptyVendorUser = await userRepo.save({
        firstName: 'Empty',
        lastName: 'VS',
        role: UserRole.VENDOR,
        isOnboarded: true,
      });
      const emptyVendor = await vendorRepo.save({
        userId: emptyVendorUser.id,
        schoolId: school.id,
        shopName: 'Empty Snack VS',
        status: VendorStatus.ACTIVE,
      });

      await scheduler.sendVendorSummaries();

      const notifications = await notificationRepo.find({
        where: {
          userId: emptyVendorUser.id,
          type: NotificationType.VENDOR_SUMMARY,
        },
      });
      expect(notifications.length).toBe(0);

      await vendorRepo.delete({ id: emptyVendor.id });
      await userRepo.delete({ id: emptyVendorUser.id });
    });
  });
});
