import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('PUT /api/v1/orders/:id/complete', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;
  let wallet: Wallet;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;

  const makeOrder = async (status = OrderStatus.VALIDATED) =>
    orderRepo.save({
      vendorId: vendor.id,
      studentId: student.id,
      status,
      totalAmount: 1000,
      expiresAt: new Date(Date.now() + 900000),
      scheduledFor: new Date().toISOString().slice(0, 10),
    });

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    vendorWalletRepo = ds.getRepository(VendorWallet);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    transactionRepo = ds.getRepository(Transaction);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-CO']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
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
          await vendorWalletRepo.delete({ vendorId: v.id });
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100006100',
      '+2250100006101',
      '+2250100006102',
      '+2250100006103',
      '+2250100006104',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Complete Order',
      sigle: 'TS-CO',
      address: '1 Complete St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminCO',
      phone: '+2250100006100',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'CO',
      phone: '+2250100006101',
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
      shopName: 'Snack CO',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorCO',
      phone: '+2250100006102',
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
      shopName: 'Other Snack CO',
      status: VendorStatus.ACTIVE,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'CO',
      phone: '+2250100006103',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'CO',
      phone: '+2250100006104',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 5000,
      reserved: 0,
    });
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await orderRepo.delete({ studentId: student.id });
    await walletRepo.delete({ id: wallet.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: otherVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100006100',
      '+2250100006101',
      '+2250100006102',
      '+2250100006103',
      '+2250100006104',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should complete a validated order as VENDOR', async () => {
      const order = await makeOrder(OrderStatus.VALIDATED);

      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.COMPLETED);
    });

    it('should complete a validated order as SUPER_ADMIN', async () => {
      const order = await makeOrder(OrderStatus.VALIDATED);

      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.COMPLETED);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app)).put(
        `/api/v1/orders/${order.id}/complete`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT calls this endpoint', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR calls for another vendor order', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when order does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/orders/00000000-0000-0000-0000-000000000000/complete')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when order is not validated (still pending)', async () => {
      const order = await makeOrder(OrderStatus.PENDING);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 when order is already completed', async () => {
      const order = await makeOrder(OrderStatus.COMPLETED);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(400);
    });
  });
});
