import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import {
  OrderStatus,
  PaymentMethod,
} from '../../src/modules/orders/order.types';

describe('GET /api/v1/schools/:id/stats', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let vendorRepo: Repository<Vendor>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let student: Student;
  let parent: Parent;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;

  const phones = [
    '+2250100030100',
    '+2250100030101',
    '+2250100030102',
    '+2250100030103',
    '+2250100030104',
    '+2250100030105',
  ];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    vendorRepo = ds.getRepository(Vendor);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SST', 'TS-SST2']) {
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
      name: 'School Stats Test',
      sigle: 'TS-SST',
      address: '1 Stats Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School Stats',
      sigle: 'TS-SST2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSST',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSST',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownSchoolAdminToken = jwtService.sign({
      sub: ownAdmin.id,
      role: ownAdmin.role,
    });

    const otherAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminSST',
      phone: phones[2],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'SST',
      phone: phones[3],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack SST',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'SST',
      phone: phones[4],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '4ème A',
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'SST',
      phone: phones[5],
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    await orderRepo.save([
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.COMPLETED,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 1200,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: new Date().toISOString().slice(0, 10),
      },
      {
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.PENDING,
        paymentMethod: PaymentMethod.WALLET,
        totalAmount: 700,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: new Date().toISOString().slice(0, 10),
      },
    ]);
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await studentParentRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await parentRepo.delete({ id: parent.id });
    await vendorRepo.delete({ schoolId: school.id });
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
    it('should return stats for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/stats`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue).toBe(1200);
      expect(res.body.data.volume).toBe(1);
      expect(res.body.data.studentsCount).toBe(1);
      expect(res.body.data.vendorsCount).toBe(1);
      expect(res.body.data.parentsCount).toBe(1);
    });

    it('should return stats for SCHOOL_ADMIN of their own school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/stats`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue).toBe(1200);
      expect(res.body.data.studentsCount).toBe(1);
    });

    it('should return zeros for a school with no orders', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${otherSchool.id}/stats`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue).toBe(0);
      expect(res.body.data.volume).toBe(0);
      expect(res.body.data.studentsCount).toBe(0);
    });

    it('should filter by date range', async () => {
      const res = await request(getServer(app))
        .get(
          `/api/v1/schools/${school.id}/stats?from=2000-01-01T00:00:00Z&to=2000-12-31T23:59:59Z`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue).toBe(0);
      expect(res.body.data.volume).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/schools/${school.id}/stats`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/stats`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when role is insufficient (VENDOR)', async () => {
      const vendorLoginUser = await userRepo.findOne({
        where: { phone: phones[3] },
      });
      const vendorToken = jwtService.sign({
        sub: vendorLoginUser!.id,
        role: vendorLoginUser!.role,
      });
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/stats`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/00000000-0000-0000-0000-000000000000/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when date format is invalid', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/stats?from=not-a-date`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
