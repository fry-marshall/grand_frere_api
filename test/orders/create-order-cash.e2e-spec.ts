import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrderItem } from '../../src/modules/orders/entities/order-item.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import { PaymentMethod } from '../../src/modules/orders/order.types';

describe('POST /api/v1/orders/vendor/:id (CASH payment)', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let itemRepo: Repository<Item>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let transactionRepo: Repository<Transaction>;
  let jwtService: JwtService;

  let vendor: Vendor;
  let item: Item;
  let student: Student;
  let studentToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    vendorWalletRepo = ds.getRepository(VendorWallet);
    itemRepo = ds.getRepository(Item);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    orderItemRepo = ds.getRepository(OrderItem);
    transactionRepo = ds.getRepository(Transaction);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-CASH' } });
    if (leftover) {
      const orders = await orderRepo.find({
        where: {
          vendorId: (
            await vendorRepo.findOne({ where: { schoolId: leftover.id } })
          )?.id,
        },
      });
      for (const o of orders) {
        await orderItemRepo.delete({ orderId: o.id });
        await transactionRepo.delete({ orderId: o.id });
      }
      await orderRepo.delete({
        studentId: (
          await studentRepo.findOne({ where: { schoolId: leftover.id } })
        )?.id,
      });
      const vendors = await vendorRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const v of vendors) {
        await itemRepo.delete({ vendorId: v.id });
        await vendorWalletRepo.delete({ vendorId: v.id });
        await vendorRepo.delete({ id: v.id });
      }
      const students = await studentRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const s of students) {
        await walletRepo.delete({ studentId: s.id });
      }
      await studentRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    const school = await schoolRepo.save({
      name: 'Cash Order School',
      sigle: 'TS-CASH',
      address: '1 Cash Street',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'Cash',
      phone: '+2250100006000',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Cash Cantine',
      status: VendorStatus.ACTIVE,
    });
    await vendorWalletRepo.save({ vendorId: vendor.id });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Thiéboudienne',
      price: 1500,
      description: 'Riz au poisson',
      status: ItemStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'Cash',
      phone: '+2250100006001',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id, balance: 0 });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
  });

  afterAll(async () => {
    const school = await schoolRepo.findOne({ where: { sigle: 'TS-CASH' } });
    if (school) {
      const orders = await orderRepo.find({
        where: { studentId: student?.id },
      });
      for (const o of orders) {
        await orderItemRepo.delete({ orderId: o.id });
        await transactionRepo.delete({ orderId: o.id });
        await orderRepo.delete({ id: o.id });
      }
      const vendors = await vendorRepo.find({ where: { schoolId: school.id } });
      for (const v of vendors) {
        await itemRepo.delete({ vendorId: v.id });
        await vendorWalletRepo.delete({ vendorId: v.id });
        await vendorRepo.delete({ id: v.id });
      }
      const students = await studentRepo.find({
        where: { schoolId: school.id },
      });
      for (const s of students) {
        await walletRepo.delete({ studentId: s.id });
      }
      await studentRepo.delete({ schoolId: school.id });
      await userRepo.delete({ schoolId: school.id });
      await schoolRepo.delete({ id: school.id });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should create a CASH order even with empty wallet balance', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item.id, quantity: 1 }],
          paymentMethod: PaymentMethod.CASH,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentMethod).toBe('CASH');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.totalAmount).toBe(1500);
    });

    it('should NOT create a RESERVE transaction for a CASH order', async () => {
      const orders = await orderRepo.find({ where: { studentId: student.id } });
      for (const o of orders) {
        const tx = await transactionRepo.findOne({ where: { orderId: o.id } });
        expect(tx).toBeNull();
      }
    });

    it('should NOT decrease wallet balance for a CASH order', async () => {
      const refreshedWallet = await walletRepo.findOne({
        where: { studentId: student.id },
      });
      expect(refreshedWallet!.balance).toBe(0);
      expect(refreshedWallet!.reserved).toBe(0);
    });

    it('should default to WALLET when paymentMethod is omitted', async () => {
      const studentUser2 = await userRepo.save({
        firstName: 'Student2',
        lastName: 'Cash',
        phone: '+2250100006002',
        role: UserRole.STUDENT,
        schoolId: (await schoolRepo.findOne({ where: { sigle: 'TS-CASH' } }))!
          .id,
        isOnboarded: true,
      });
      const student2 = await studentRepo.save({
        userId: studentUser2.id,
        schoolId: (await schoolRepo.findOne({ where: { sigle: 'TS-CASH' } }))!
          .id,
      });
      const wallet2 = await walletRepo.save({
        studentId: student2.id,
        balance: 5000,
      });
      const token2 = jwtService.sign({
        sub: studentUser2.id,
        role: studentUser2.role,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({
          studentId: student2.id,
          items: [{ itemId: item.id, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentMethod).toBe('WALLET');

      const refreshed = await walletRepo.findOne({ where: { id: wallet2.id } });
      expect(refreshed!.reserved).toBe(1500);
    });

    it('should validate a CASH order without touching the wallet', async () => {
      const cashOrder = await orderRepo.findOne({
        where: { studentId: student.id, paymentMethod: PaymentMethod.CASH },
      });

      const walletBefore = await walletRepo.findOne({
        where: { studentId: student.id },
      });
      const vendorWalletBefore = await vendorWalletRepo.findOne({
        where: { vendorId: vendor.id },
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/orders/${cashOrder!.id}/validate`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('VALIDATED');

      const walletAfter = await walletRepo.findOne({
        where: { studentId: student.id },
      });
      const vendorWalletAfter = await vendorWalletRepo.findOne({
        where: { vendorId: vendor.id },
      });

      expect(walletAfter!.balance).toBe(walletBefore!.balance);
      expect(walletAfter!.reserved).toBe(walletBefore!.reserved);
      expect(vendorWalletAfter!.balance).toBe(vendorWalletBefore!.balance);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when paymentMethod is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item.id, quantity: 1 }],
          paymentMethod: 'CHEQUE',
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 for WALLET order when balance is insufficient', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item.id, quantity: 1 }],
          paymentMethod: PaymentMethod.WALLET,
        });

      expect(res.status).toBe(400);
    });
  });
});
