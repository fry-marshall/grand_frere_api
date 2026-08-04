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

describe('GET /api/v1/transactions', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let jwtService: JwtService;

  let schoolA: School;
  let schoolB: School;
  let walletA: Wallet;
  let walletB: Wallet;

  let superAdminToken: string;
  let schoolAdminAToken: string;
  let schoolAdminBToken: string;
  let vendorToken: string;

  let from: string;
  let to: string;

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
    walletRepo = ds.getRepository(Wallet);
    transactionRepo = ds.getRepository(Transaction);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-TXA', 'TS-TXB']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    schoolA = await schoolRepo.save({
      name: 'School Transactions A',
      sigle: 'TS-TXA',
      address: '1 Global Street',
      status: SchoolStatus.ACTIVE,
    });
    schoolB = await schoolRepo.save({
      name: 'School Transactions B',
      sigle: 'TS-TXB',
      address: '2 Global Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminGTX',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const adminA = await userRepo.save({
      firstName: 'Admin',
      lastName: 'GTXA',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: schoolA.id,
      isOnboarded: true,
    });
    schoolAdminAToken = jwtService.sign({ sub: adminA.id, role: adminA.role });

    const adminB = await userRepo.save({
      firstName: 'Admin',
      lastName: 'GTXB',
      phone: phones[2],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: schoolB.id,
      isOnboarded: true,
    });
    schoolAdminBToken = jwtService.sign({ sub: adminB.id, role: adminB.role });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'GTX',
      phone: phones[3],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    const studentUserA = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'GTXA',
      phone: phones[4],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    const studentA = await studentRepo.save({
      userId: studentUserA.id,
      schoolId: schoolA.id,
    });
    walletA = await walletRepo.save({
      studentId: studentA.id,
      balance: 1000,
      currency: Currency.XOF,
    });

    const studentUserB = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'GTXB',
      phone: phones[5],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    const studentB = await studentRepo.save({
      userId: studentUserB.id,
      schoolId: schoolB.id,
    });
    walletB = await walletRepo.save({
      studentId: studentB.id,
      balance: 500,
      currency: Currency.XOF,
    });

    from = new Date().toISOString();

    await transactionRepo.save([
      {
        walletId: walletA.id,
        type: TransactionType.CREDIT,
        amount: 4000,
        currency: Currency.XOF,
        balanceBefore: 0,
        balanceAfter: 4000,
      },
      {
        walletId: walletB.id,
        type: TransactionType.CREDIT,
        amount: 1500,
        currency: Currency.XOF,
        balanceBefore: 0,
        balanceAfter: 1500,
      },
    ]);

    to = new Date().toISOString();
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: walletA.id });
    await transactionRepo.delete({ walletId: walletB.id });
    await walletRepo.delete({ id: walletA.id });
    await walletRepo.delete({ id: walletB.id });
    await studentRepo.delete({ schoolId: schoolA.id });
    await studentRepo.delete({ schoolId: schoolB.id });
    await userRepo.delete({ schoolId: schoolA.id });
    await userRepo.delete({ schoolId: schoolB.id });
    await schoolRepo.delete({ id: schoolA.id });
    await schoolRepo.delete({ id: schoolB.id });
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return transactions from all schools for SUPER_ADMIN when schoolId is omitted', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/transactions?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(2);
      expect(res.body.data.stats.totalTransactions).toBe(2);
      expect(res.body.data.stats.totalCredits).toBe(5500);
    });

    it('should scope SUPER_ADMIN results to schoolId when provided', async () => {
      const res = await request(getServer(app))
        .get(
          `/api/v1/transactions?schoolId=${schoolA.id}&from=${from}&to=${to}`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(1);
      expect(res.body.data.stats.totalCredits).toBe(4000);
    });

    it('should auto-scope SCHOOL_ADMIN to their own school when schoolId is omitted', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/transactions?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${schoolAdminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(1);
      expect(res.body.data.stats.totalCredits).toBe(4000);
    });

    it('should auto-scope a different SCHOOL_ADMIN to their own school (school B)', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/transactions?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${schoolAdminBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(1);
      expect(res.body.data.stats.totalCredits).toBe(1500);
    });

    it('should allow SCHOOL_ADMIN to explicitly pass their own schoolId', async () => {
      const res = await request(getServer(app))
        .get(
          `/api/v1/transactions?schoolId=${schoolA.id}&from=${from}&to=${to}`,
        )
        .set('Authorization', `Bearer ${schoolAdminAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.meta.total).toBe(1);
    });

    it('should respect pagination params', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/transactions?from=${from}&to=${to}&page=1&limit=1`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.transactions.data.length).toBe(1);
      expect(res.body.data.transactions.meta.total).toBe(2);
      expect(res.body.data.transactions.meta.totalPages).toBe(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(getServer(app)).get('/api/v1/transactions');
      expect(res.status).toBe(401);
    });

    it('should return 403 when role is insufficient (VENDOR)', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/transactions')
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN requests a foreign schoolId', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/transactions?schoolId=${schoolB.id}`)
        .set('Authorization', `Bearer ${schoolAdminAToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when schoolId does not exist', async () => {
      const res = await request(getServer(app))
        .get(
          '/api/v1/transactions?schoolId=00000000-0000-0000-0000-000000000000',
        )
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when schoolId is not a valid UUID', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/transactions?schoolId=not-a-uuid')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 when date format is invalid', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/transactions?from=not-a-date')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
