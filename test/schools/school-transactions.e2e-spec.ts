import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { TransactionType } from '../../src/modules/wallets/wallet.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('GET /api/v1/schools/:id/transactions', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let wallet: Wallet;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;

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

    for (const sigle of ['TS-TX', 'TS-TX2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Transactions Test',
      sigle: 'TS-TX',
      address: '1 Transaction Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other School TX',
      sigle: 'TS-TX2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminTX',
      phone: '+2250100000560',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminTX',
      phone: '+2250100000561',
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
      lastName: 'AdminTX',
      phone: '+2250100000562',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Élève',
      lastName: 'Wallet',
      phone: '+2250100000563',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '5ème C',
    });

    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 3000,
      currency: Currency.XOF,
    });

    await transactionRepo.save([
      {
        walletId: wallet.id,
        type: TransactionType.CREDIT,
        amount: 5000,
        currency: Currency.XOF,
        balanceBefore: 0,
        balanceAfter: 5000,
      },
      {
        walletId: wallet.id,
        type: TransactionType.DEBIT,
        amount: 2000,
        currency: Currency.XOF,
        balanceBefore: 5000,
        balanceAfter: 3000,
      },
    ]);
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await walletRepo.delete({ id: wallet.id });
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000560',
      '+2250100000561',
      '+2250100000562',
      '+2250100000563',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return transactions and stats for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/transactions`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.transactions.data)).toBe(true);
      expect(res.body.data.transactions.data.length).toBe(2);
      expect(res.body.data.transactions.meta.total).toBe(2);
      expect(res.body.data.stats.totalTransactions).toBe(2);
      expect(res.body.data.stats.totalCredits).toBe(5000);
      expect(res.body.data.stats.totalDebits).toBe(2000);
      expect(res.body.data.transactions.data[0].student).toBeDefined();
      expect(res.body.data.transactions.data[0].student.user.firstName).toBe(
        'Élève',
      );
    });

    it('should return transactions for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/transactions`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(2);
    });

    it('should return empty for school with no transactions', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${otherSchool.id}/transactions`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.data).toEqual([]);
      expect(res.body.data.stats.totalTransactions).toBe(0);
      expect(res.body.data.stats.totalCredits).toBe(0);
      expect(res.body.data.stats.totalDebits).toBe(0);
    });

    it('should filter by date range', async () => {
      const res = await request(getServer(app))
        .get(
          `/api/v1/schools/${school.id}/transactions?from=2020-01-01T00:00:00Z&to=2099-12-31T23:59:59Z`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(2);
    });

    it('should return empty when date range excludes all transactions', async () => {
      const res = await request(getServer(app))
        .get(
          `/api/v1/schools/${school.id}/transactions?from=2000-01-01T00:00:00Z&to=2000-12-31T23:59:59Z`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(0);
    });

    it('should respect pagination params', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/transactions?page=1&limit=1`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.data.length).toBe(1);
      expect(res.body.data.transactions.meta.total).toBe(2);
      expect(res.body.data.transactions.meta.totalPages).toBe(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/schools/${school.id}/transactions`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/transactions`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(getServer(app))
        .get(
          '/api/v1/schools/00000000-0000-0000-0000-000000000000/transactions',
        )
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when date format is invalid', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/transactions?from=not-a-date`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
