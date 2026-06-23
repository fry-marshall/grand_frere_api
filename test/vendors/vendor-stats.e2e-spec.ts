import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import {
  OrderStatus,
  PaymentMethod,
} from '../../src/modules/orders/order.types';

describe('GET /api/v1/vendors/:id/stats', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;

  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-VST']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100010100',
      '+2250100010101',
      '+2250100010102',
      '+2250100010103',
      '+2250100010104',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School VendorStats',
      sigle: 'TS-VST',
      address: '1 Stats St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminVST',
      phone: '+2250100010100',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'VST',
      phone: '+2250100010101',
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
      shopName: 'Snack VST',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorVST',
      phone: '+2250100010102',
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
      shopName: 'Other Snack VST',
      status: VendorStatus.ACTIVE,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'VST',
      phone: '+2250100010103',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'VST',
      phone: '+2250100010104',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });

    await orderRepo.save([
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 1500,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: today,
      },
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.VALIDATED,
        paymentMethod: PaymentMethod.CASH,
        totalAmount: 800,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: today,
      },
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.CANCELLED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 500,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: today,
      },
    ]);
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await orderRepo.delete({ vendorId: otherVendor.id });
    await studentRepo.delete({ id: student.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100010100',
      '+2250100010101',
      '+2250100010102',
      '+2250100010103',
      '+2250100010104',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return correct stats for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/stats`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.todayOrderCount).toBe(2); // CANCELLED excluded
      expect(res.body.data.todayRevenue).toBe(1500); // COMPLETED only
      expect(res.body.data.cashToCollect).toBe(800); // VALIDATED + CASH
    });

    it('should return correct stats for own VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/stats`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.todayOrderCount).toBe(2);
      expect(res.body.data.todayRevenue).toBe(1500);
      expect(res.body.data.cashToCollect).toBe(800);
    });

    it('should return zeros for a vendor with no orders today', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${otherVendor.id}/stats`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.todayOrderCount).toBe(0);
      expect(res.body.data.todayRevenue).toBe(0);
      expect(res.body.data.cashToCollect).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/vendors/${vendor.id}/stats`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT calls this endpoint', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/stats`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor stats', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/stats`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
