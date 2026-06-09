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
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('GET /api/v1/students/:id/orders', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let vendorRepo: Repository<Vendor>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let ownStudentToken: string;
  let otherStudentToken: string;

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

    for (const sigle of ['TS-SO', 'TS-SO2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo
          .createQueryBuilder()
          .select('id')
          .where('"schoolId" = :sid', { sid: leftover.id })
          .getMany()
          .then(async (vendors) => {
            for (const v of vendors) {
              await orderRepo.delete({ vendorId: v.id });
            }
          });
        await orderRepo
          .createQueryBuilder()
          .delete()
          .where(
            'studentId IN (SELECT id FROM students WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Student Orders',
      sigle: 'TS-SO',
      address: '1 Orders Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School SO',
      sigle: 'TS-SO2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSO',
      phone: '+2250100000660',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSO',
      phone: '+2250100000661',
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
      lastName: 'AdminSO',
      phone: '+2250100000662',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Adjoua',
      lastName: 'Assi',
      phone: '+2250100000663',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: 'CM2',
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Koffi',
      lastName: 'Blé',
      phone: '+2250100000664',
      role: UserRole.STUDENT,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
    await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: otherSchool.id,
      class: 'CM1',
    });

    const vendorUser = await userRepo.save({
      firstName: 'Gnénékan',
      lastName: 'Coulibaly',
      phone: '+2250100000665',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    const vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack Gnénékan',
      status: VendorStatus.ACTIVE,
    });

    await orderRepo.save({
      studentId: student.id,
      vendorId: vendor.id,
      status: OrderStatus.VALIDATED,
      totalAmount: 750,
      expiresAt: new Date(Date.now() + 3600000),
    });
  });

  afterAll(async () => {
    await orderRepo.delete({ studentId: student.id });
    await vendorRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000660',
      '+2250100000661',
      '+2250100000662',
      '+2250100000663',
      '+2250100000664',
      '+2250100000665',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return orders for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/orders`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].totalAmount).toBe(750);
      expect(res.body.data.data[0].vendor).toBeDefined();
      expect(res.body.data.meta.total).toBe(1);
    });

    it('should return orders for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/orders`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should return own orders for STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/orders`)
        .set('Authorization', `Bearer ${ownStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should return empty list for student with no orders', async () => {
      const otherStudent = await studentRepo.findOne({
        where: { schoolId: otherSchool.id },
      });
      const res = await request(getServer(app))
        .get(`/api/v1/students/${otherStudent!.id}/orders`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/students/${student.id}/orders`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school student', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/orders`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another student orders', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/orders`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/00000000-0000-0000-0000-000000000000/orders')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
