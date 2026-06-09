import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Payment } from '../../src/modules/payments/entities/payment.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { PaymentStatus } from '../../src/modules/payments/payment.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('GET /api/v1/payments', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let paymentRepo: Repository<Payment>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let wallet: Wallet;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let parentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    paymentRepo = ds.getRepository(Payment);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-PL', 'TS-PL2']) {
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
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100004000',
      '+2250100004001',
      '+2250100004002',
      '+2250100004003',
      '+2250100004004',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School PayList',
      sigle: 'TS-PL',
      address: '1 PayList St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School PL',
      sigle: 'TS-PL2',
      address: '2 PayList St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminPL',
      phone: '+2250100004000',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const adminUser = await userRepo.save({
      firstName: 'Admin',
      lastName: 'PayList',
      phone: '+2250100004001',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: adminUser.id,
      role: adminUser.role,
    });

    const otherAdminUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminPL',
      phone: '+2250100004002',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdminUser.id,
      role: otherAdminUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'PL',
      phone: '+2250100004003',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'PL',
      phone: '+2250100004004',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });

    wallet = await walletRepo.save({ studentId: student.id, balance: 0 });

    await paymentRepo.save({
      walletId: wallet.id,
      paystackRef: 'GF-PL-001',
      amount: 5000,
      currency: Currency.XOF,
      status: PaymentStatus.SUCCESS,
      initiatedBy: superAdmin.id,
    });
    await paymentRepo.save({
      walletId: wallet.id,
      paystackRef: 'GF-PL-002',
      amount: 3000,
      currency: Currency.XOF,
      status: PaymentStatus.PENDING,
      initiatedBy: superAdmin.id,
    });
  });

  afterAll(async () => {
    await paymentRepo.delete({ walletId: wallet.id });
    await walletRepo.delete({ id: wallet.id });
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100004000',
      '+2250100004001',
      '+2250100004002',
      '+2250100004003',
      '+2250100004004',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all payments for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should return payments for own school for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should return empty list for SCHOOL_ADMIN with no payments in their school', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
    });

    it('should respect pagination', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/payments?page=1&limit=1')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/payments');
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT calls this endpoint', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });
  });
});
