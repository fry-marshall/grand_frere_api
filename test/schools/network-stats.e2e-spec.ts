import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import {
  OrderStatus,
  PaymentMethod,
} from '../../src/modules/orders/order.types';

describe('GET /api/v1/schools/stats', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let vendorRepo: Repository<Vendor>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let student: Student;

  let superAdminToken: string;
  let schoolAdminToken: string;

  const phones = [
    '+2250100020100',
    '+2250100020101',
    '+2250100020102',
    '+2250100020103',
  ];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    vendorRepo = ds.getRepository(Vendor);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-NST']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School NetworkStats',
      sigle: 'TS-NST',
      address: '1 Network St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminNST',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminNST',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'NST',
      phone: phones[2],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack NST',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'NST',
      phone: phones[3],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await studentRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should compute network revenue/volume scoped to a date window, ignoring non-completed orders', async () => {
      const from = new Date().toISOString();

      await orderRepo.save([
        {
          vendorId: vendor.id,
          studentId: student.id,
          status: OrderStatus.COMPLETED,
          paymentMethod: PaymentMethod.WALLET,
          totalAmount: 2500,
          expiresAt: new Date(Date.now() + 3600000),
          scheduledFor: new Date().toISOString().slice(0, 10),
        },
        {
          vendorId: vendor.id,
          studentId: student.id,
          status: OrderStatus.CANCELLED,
          paymentMethod: PaymentMethod.WALLET,
          totalAmount: 9999,
          expiresAt: new Date(Date.now() + 3600000),
          scheduledFor: new Date().toISOString().slice(0, 10),
        },
      ]);

      const to = new Date().toISOString();

      const res = await request(getServer(app))
        .get(`/api/v1/schools/stats?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenue).toBe(2500);
      expect(res.body.data.orderVolume).toBe(1);

      const schoolEntry = res.body.data.schools.find(
        (s: { schoolId: string }) => s.schoolId === school.id,
      );
      expect(schoolEntry).toBeDefined();
      expect(schoolEntry.revenue).toBe(2500);
      expect(schoolEntry.volume).toBe(1);
      expect(schoolEntry.name).toBe('School NetworkStats');
      expect(schoolEntry.sigle).toBe('TS-NST');
      expect(schoolEntry.status).toBe(SchoolStatus.ACTIVE);
    });

    it('should count the active student created for this test', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activeStudentsCount).toBeGreaterThanOrEqual(1);
    });

    it('should count active and suspended schools network-wide', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.activeSchoolsCount).toBeGreaterThanOrEqual(1);
      expect(typeof res.body.data.suspendedSchoolsCount).toBe('number');
    });

    it('should return zero revenue/volume for a window with no orders', async () => {
      const res = await request(getServer(app))
        .get(
          '/api/v1/schools/stats?from=2000-01-01T00:00:00Z&to=2000-12-31T23:59:59Z',
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalRevenue).toBe(0);
      expect(res.body.data.orderVolume).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(getServer(app)).get('/api/v1/schools/stats');
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 400 when date format is invalid', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats?from=not-a-date')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
