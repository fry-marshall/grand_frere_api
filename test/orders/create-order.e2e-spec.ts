import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('POST /api/v1/orders/vendor/:vendorId', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let itemRepo: Repository<Item>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let transactionRepo: Repository<Transaction>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let student: Student;
  let wallet: Wallet;
  let item1: Item;
  let item2: Item;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let otherVendor: Vendor;
  let parentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    itemRepo = ds.getRepository(Item);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    transactionRepo = ds.getRepository(Transaction);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-ORD', 'TS-ORD2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) {
          const leftItems = await itemRepo.find({ where: { vendorId: v.id } });
          for (const it of leftItems) {
            await orderRepo
              .createQueryBuilder()
              .delete()
              .where('"itemId" = :id', { id: it.id })
              .execute();
          }
          await itemRepo.delete({ vendorId: v.id });
        }
        const leftStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftStudents) {
          const leftWallet = await walletRepo.findOne({
            where: { studentId: s.id },
          });
          if (leftWallet) {
            await transactionRepo.delete({ walletId: leftWallet.id });
            await orderRepo.delete({ studentId: s.id });
            await walletRepo.delete({ id: leftWallet.id });
          }
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100005000',
      '+2250100005001',
      '+2250100005002',
      '+2250100005003',
      '+2250100005004',
      '+2250100005005',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Orders',
      sigle: 'TS-ORD',
      address: '1 Order St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminORD',
      phone: '+2250100005000',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Binta',
      lastName: 'ORD',
      phone: '+2250100005001',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack ORD',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorORD',
      phone: '+2250100005002',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: school.id,
      shopName: 'Other Snack ORD',
      status: VendorStatus.ACTIVE,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'ORD',
      phone: '+2250100005003',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'ORD',
      phone: '+2250100005004',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '5eme A',
    });

    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 10000,
      reserved: 0,
    });

    item1 = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Sandwich',
      price: 500,
      status: ItemStatus.ACTIVE,
    });
    item2 = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Jus',
      price: 300,
      status: ItemStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await orderRepo.delete({ studentId: student.id });
    await walletRepo.delete({ id: wallet.id });
    await itemRepo.delete({ vendorId: vendor.id });
    await itemRepo.delete({ vendorId: otherVendor.id });
    await studentRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100005000',
      '+2250100005001',
      '+2250100005002',
      '+2250100005003',
      '+2250100005004',
      '+2250100005005',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should create an order as VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          studentId: student.id,
          items: [
            { itemId: item1.id, quantity: 2 },
            { itemId: item2.id, quantity: 1 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.vendorId).toBe(vendor.id);
      expect(res.body.data.studentId).toBe(student.id);
      expect(res.body.data.totalAmount).toBe(1300); // 2*500 + 1*300
      expect(res.body.data.status).toBe(OrderStatus.PENDING);
      expect(res.body.data.expiresAt).toBeDefined();

      const updatedWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(updatedWallet!.reserved).toBe(1300);
    });

    it('should create an order as SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.totalAmount).toBe(500);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR calls with another vendor id', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/orders/vendor/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(404);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          studentId: '00000000-0000-0000-0000-000000000000',
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(404);
    });

    it('should return 400 when item belongs to another vendor', async () => {
      const foreignItem = await itemRepo.save({
        vendorId: otherVendor.id,
        name: 'Foreign Item',
        price: 200,
        status: ItemStatus.ACTIVE,
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: foreignItem.id, quantity: 1 }],
        });
      expect(res.status).toBe(400);

      await itemRepo.delete({ id: foreignItem.id });
    });

    it('should return 400 when wallet balance is insufficient', async () => {
      await walletRepo.update(wallet.id, { balance: 0, reserved: 0 });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/orders/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item1.id, quantity: 1 }],
        });
      expect(res.status).toBe(400);

      await walletRepo.update(wallet.id, { balance: 10000, reserved: 0 });
    });
  });
});
