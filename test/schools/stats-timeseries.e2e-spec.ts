import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import {
  OrderStatus,
  PaymentMethod,
} from '../../src/modules/orders/order.types';

describe('GET /api/v1/schools/stats/timeseries', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let vendorRepo: Repository<Vendor>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherSchoolVendor: Vendor;
  let student: Student;
  let otherSchoolStudent: Student;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let vendorToken: string;

  const phones = [
    '+2250100040100',
    '+2250100040101',
    '+2250100040102',
    '+2250100040103',
    '+2250100040104',
    '+2250100040105',
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

    for (const sigle of ['TS-TSR', 'TS-TSR2']) {
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
      name: 'School Timeseries',
      sigle: 'TS-TSR',
      address: '1 Timeseries St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School Timeseries',
      sigle: 'TS-TSR2',
      address: '2 Timeseries St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminTSR',
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
      lastName: 'AdminTSR',
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
      lastName: 'TSR',
      phone: phones[2],
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
      shopName: 'Snack TSR',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'TSR',
      phone: phones[3],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'TSR2',
      phone: phones[4],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherSchoolVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Snack TSR2',
      status: VendorStatus.ACTIVE,
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'TSR2',
      phone: phones[5],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    otherSchoolStudent = await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: otherSchool.id,
    });

    await orderRepo.save([
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 1000,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: new Date().toISOString().slice(0, 10),
      },
      {
        vendorId: otherSchoolVendor.id,
        studentId: otherSchoolStudent.id,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 500,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: new Date().toISOString().slice(0, 10),
      },
    ]);
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await orderRepo.delete({ vendorId: otherSchoolVendor.id });
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return 7 day buckets by default, with today including the completed order', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const buckets = res.body.data.buckets as {
        label: string;
        revenue: number;
        volume: number;
      }[];
      expect(buckets.length).toBe(7);
      const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
      const totalVolume = buckets.reduce((sum, b) => sum + b.volume, 0);
      expect(totalRevenue).toBeGreaterThanOrEqual(1500);
      expect(totalVolume).toBeGreaterThanOrEqual(2);
    });

    it('should return 8 buckets for week granularity and 6 for month', async () => {
      const weekRes = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries?granularity=week')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(weekRes.status).toBe(200);
      expect(weekRes.body.data.buckets.length).toBe(8);

      const monthRes = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries?granularity=month')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(monthRes.status).toBe(200);
      expect(monthRes.body.data.buckets.length).toBe(6);
    });

    it('should scope to a single school when schoolId is provided', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/stats/timeseries?schoolId=${school.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const buckets = res.body.data.buckets as {
        revenue: number;
        volume: number;
      }[];
      const totalRevenue = buckets.reduce((sum, b) => sum + b.revenue, 0);
      expect(totalRevenue).toBe(1000);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        '/api/v1/schools/stats/timeseries',
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when role is insufficient (VENDOR)', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries')
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 400 for an invalid granularity', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/stats/timeseries?granularity=year')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
