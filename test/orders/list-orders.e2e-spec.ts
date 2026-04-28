import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('GET /api/v1/orders', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;
  let studentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-OL', 'TS-OL2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftStudents) {
          await orderRepo.delete({ studentId: s.id });
          await walletRepo.delete({ studentId: s.id });
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100005100',
      '+2250100005101',
      '+2250100005102',
      '+2250100005103',
      '+2250100005104',
      '+2250100005105',
      '+2250100005106',
      '+2250100005107',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School List Orders',
      sigle: 'TS-OL',
      address: '1 List Order St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School OL',
      sigle: 'TS-OL2',
      address: '2 List Order St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminOL',
      phone: '+2250100005100',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminOL',
      phone: '+2250100005101',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const otherSchoolAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminOL',
      phone: '+2250100005102',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherSchoolAdmin.id,
      role: otherSchoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'OL',
      phone: '+2250100005103',
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
      shopName: 'Snack OL',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'OtherVendor',
      lastName: 'OL',
      phone: '+2250100005104',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Snack OL',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'OL',
      phone: '+2250100005105',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '4eme A',
    });
    await walletRepo.save({ studentId: student.id, balance: 0 });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'OL',
      phone: '+2250100005106',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    await orderRepo.save({
      vendorId: vendor.id,
      studentId: student.id,
      status: OrderStatus.PENDING,
      totalAmount: 500,
      expiresAt: new Date(Date.now() + 900000),
    });
    await orderRepo.save({
      vendorId: vendor.id,
      studentId: student.id,
      status: OrderStatus.VALIDATED,
      totalAmount: 300,
      expiresAt: new Date(Date.now() + 900000),
    });
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await orderRepo.delete({ vendorId: otherVendor.id });
    await walletRepo.delete({ studentId: student.id });
    await studentParentRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    for (const phone of [
      '+2250100005100',
      '+2250100005101',
      '+2250100005102',
      '+2250100005103',
      '+2250100005104',
      '+2250100005105',
      '+2250100005106',
      '+2250100005107',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u?.role === UserRole.PARENT) {
        await parentRepo.delete({ userId: u.id });
      }
      await userRepo.delete({ phone });
    }
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all orders for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should return only school orders for SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should return empty list for SCHOOL_ADMIN with no orders in their school', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
    });

    it('should return own orders for VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should return empty list for VENDOR with no orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${otherVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
    });

    it('should return linked student orders for PARENT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should return own orders for STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should respect pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/orders');
      expect(res.status).toBe(401);
    });
  });
});
