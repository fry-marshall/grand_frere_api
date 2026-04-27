import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { TransactionType } from '../../src/modules/wallets/wallet.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('GET /api/v1/students/:id/transactions', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;
  let wallet: Wallet;

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
    walletRepo = ds.getRepository(Wallet);
    transactionRepo = ds.getRepository(Transaction);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-STX', 'TS-STX2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftoverStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftoverStudents) {
          const w = await walletRepo.findOne({ where: { studentId: s.id } });
          if (w) {
            await transactionRepo.delete({ walletId: w.id });
            await walletRepo.delete({ id: w.id });
          }
        }
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Student Transactions',
      sigle: 'TS-STX',
      address: '1 Tx Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School STX',
      sigle: 'TS-STX2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSTX',
      phone: '+2250100000670',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSTX',
      phone: '+2250100000671',
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
      lastName: 'AdminSTX',
      phone: '+2250100000672',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Akissi',
      lastName: 'Kouamé',
      phone: '+2250100000673',
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
      class: 'CE2',
    });

    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 3000,
      reserved: 0,
      currency: Currency.XOF,
    });

    await transactionRepo.save({
      walletId: wallet.id,
      type: TransactionType.CREDIT,
      amount: 5000,
      currency: Currency.XOF,
      balanceBefore: 0,
      balanceAfter: 5000,
    });
    await transactionRepo.save({
      walletId: wallet.id,
      type: TransactionType.DEBIT,
      amount: 2000,
      currency: Currency.XOF,
      balanceBefore: 5000,
      balanceAfter: 3000,
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Méite',
      lastName: 'Noël',
      phone: '+2250100000674',
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
      class: 'CE1',
    });
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await walletRepo.delete({ id: wallet.id });
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000670',
      '+2250100000671',
      '+2250100000672',
      '+2250100000673',
      '+2250100000674',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return transactions for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBe(2);
      expect(res.body.data.meta.total).toBe(2);
      expect(res.body.data.data[0].type).toBeDefined();
      expect(res.body.data.data[0].amount).toBeDefined();
    });

    it('should return transactions for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should return own transactions for STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions`)
        .set('Authorization', `Bearer ${ownStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should return empty list when student has no wallet', async () => {
      const otherStudent = await studentRepo.findOne({
        where: { schoolId: otherSchool.id },
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${otherStudent!.id}/transactions`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should support pagination', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions?page=1&limit=1`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.total).toBe(2);
      expect(res.body.data.meta.totalPages).toBe(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/students/${student.id}/transactions`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another student transactions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${student.id}/transactions`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/students/00000000-0000-0000-0000-000000000000/transactions',
        )
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
