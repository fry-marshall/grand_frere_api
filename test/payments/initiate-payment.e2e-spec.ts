import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Payment } from '../../src/modules/payments/entities/payment.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('POST /api/v1/payments/initiate', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let paymentRepo: Repository<Payment>;
  let jwtService: JwtService;

  let school: School;
  let student: Student;

  let superAdminToken: string;
  let linkedParentToken: string;
  let unlinkedParentToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let vendorToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);
    paymentRepo = ds.getRepository(Payment);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-PAY']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await paymentRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"walletId" IN (SELECT id FROM wallets WHERE "studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid))',
            { sid: leftover.id },
          )
          .execute();
        await walletRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await studentParentRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100002000',
      '+2250100002001',
      '+2250100002002',
      '+2250100002003',
      '+2250100002004',
      '+2250100002005',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Payment',
      sigle: 'TS-PAY',
      address: '1 Payment St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminPay',
      phone: '+2250100002000',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Koffi',
      lastName: 'Student',
      phone: '+2250100002001',
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
      class: 'CM1',
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'Student',
      phone: '+2250100002005',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
    await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: school.id,
      class: 'CE2',
    });

    const linkedParentUser = await userRepo.save({
      firstName: 'Mama',
      lastName: 'Parent',
      phone: '+2250100002002',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    linkedParentToken = jwtService.sign({
      sub: linkedParentUser.id,
      role: linkedParentUser.role,
    });
    const parent = await parentRepo.save({ userId: linkedParentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'Parent',
      phone: '+2250100002003',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });
    await parentRepo.save({ userId: unlinkedParentUser.id });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'Pay',
      phone: '+2250100002004',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
  });

  afterAll(async () => {
    await paymentRepo
      .createQueryBuilder()
      .delete()
      .where(
        '"walletId" IN (SELECT id FROM wallets WHERE "studentId" = :sid)',
        { sid: student.id },
      )
      .execute();
    await walletRepo.delete({ studentId: student.id });
    await studentParentRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100002000',
      '+2250100002001',
      '+2250100002002',
      '+2250100002003',
      '+2250100002004',
      '+2250100002005',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should initiate payment for linked PARENT and create wallet if missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${linkedParentToken}`)
        .send({ studentId: student.id, amount: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentId).toBeDefined();
      expect(res.body.data.authorizationUrl).toBeDefined();
      expect(res.body.data.reference).toBeDefined();

      const wallet = await walletRepo.findOne({
        where: { studentId: student.id },
      });
      expect(wallet).toBeDefined();
    });

    it('should initiate payment for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ studentId: student.id, amount: 2000 });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentId).toBeDefined();
    });

    it('should initiate payment for own STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: student.id, amount: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.data.paymentId).toBeDefined();
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .send({ studentId: student.id, amount: 5000 });
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ studentId: student.id, amount: 5000 });
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT initiates for another student', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .send({ studentId: student.id, amount: 5000 });
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT is not linked to student', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ studentId: student.id, amount: 5000 });
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          studentId: '00000000-0000-0000-0000-000000000000',
          amount: 5000,
        });
      expect(res.status).toBe(404);
    });

    it('should return 400 when amount is below minimum', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${linkedParentToken}`)
        .send({ studentId: student.id, amount: 50 });
      expect(res.status).toBe(400);
    });

    it('should return 400 when studentId is not a UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/initiate')
        .set('Authorization', `Bearer ${linkedParentToken}`)
        .send({ studentId: 'not-a-uuid', amount: 5000 });
      expect(res.status).toBe(400);
    });
  });
});
