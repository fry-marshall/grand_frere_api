import { createHmac } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Payment } from '../../src/modules/payments/entities/payment.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { PaymentStatus } from '../../src/modules/payments/payment.types';
import { TransactionType } from '../../src/modules/wallets/wallet.types';
import { Currency } from '../../src/common/enums/currency.enum';

const PAYSTACK_TEST_SECRET = 'test-paystack-secret-key';

function sign(body: object): string {
  return createHmac('sha512', PAYSTACK_TEST_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

describe('POST /api/v1/payments/webhook', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let paymentRepo: Repository<Payment>;
  let transactionRepo: Repository<Transaction>;

  let school: School;
  let student: Student;
  let wallet: Wallet;
  let pendingPayment: Payment;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    paymentRepo = ds.getRepository(Payment);
    transactionRepo = ds.getRepository(Transaction);

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-WHK' } });
    if (leftover) {
      await transactionRepo
        .createQueryBuilder()
        .delete()
        .where(
          '"walletId" IN (SELECT id FROM wallets WHERE "studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid))',
          { sid: leftover.id },
        )
        .execute();
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
    for (const phone of [
      '+2250100003000',
      '+2250100003001',
      '+2250100003002',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Webhook',
      sigle: 'TS-WHK',
      address: '1 Webhook St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdminUser = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWhk',
      phone: '+2250100003000',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'Webhook',
      phone: '+2250100003001',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });

    wallet = await walletRepo.save({ studentId: student.id, balance: 1000 });

    pendingPayment = await paymentRepo.save({
      walletId: wallet.id,
      paystackRef: 'GF-TEST-REF-001',
      amount: 5000,
      currency: Currency.XOF,
      status: PaymentStatus.PENDING,
      initiatedBy: superAdminUser.id,
    });
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await paymentRepo.delete({ walletId: wallet.id });
    await walletRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100003000',
      '+2250100003001',
      '+2250100003002',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should credit wallet and create transaction on charge.success', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: pendingPayment.paystackRef,
          amount: pendingPayment.amount,
        },
      };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);

      const updatedPayment = await paymentRepo.findOne({
        where: { id: pendingPayment.id },
      });
      expect(updatedPayment?.status).toBe(PaymentStatus.SUCCESS);

      const updatedWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(updatedWallet?.balance).toBe(1000 + pendingPayment.amount);

      const tx = await transactionRepo.findOne({
        where: { walletId: wallet.id },
      });
      expect(tx?.type).toBe(TransactionType.CREDIT);
      expect(tx?.amount).toBe(pendingPayment.amount);
      expect(tx?.balanceBefore).toBe(1000);
      expect(tx?.balanceAfter).toBe(1000 + pendingPayment.amount);
    });

    it('should be idempotent — processing the same event twice does not double-credit', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: pendingPayment.paystackRef,
          amount: pendingPayment.amount,
        },
      };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);

      const updatedWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(updatedWallet?.balance).toBe(1000 + pendingPayment.amount);
    });

    it('should return 200 and ignore unknown events', async () => {
      const body = { event: 'transfer.success', data: {} };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);
    });

    it('should return 200 and ignore unknown references', async () => {
      const body = {
        event: 'charge.success',
        data: { reference: 'UNKNOWN-REF-999', amount: 5000 },
      };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', sign(body))
        .send(body);

      expect(res.status).toBe(200);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when signature is missing', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: pendingPayment.paystackRef,
          amount: pendingPayment.amount,
        },
      };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .send(body);

      expect(res.status).toBe(401);
    });

    it('should return 401 when signature is invalid', async () => {
      const body = {
        event: 'charge.success',
        data: {
          reference: pendingPayment.paystackRef,
          amount: pendingPayment.amount,
        },
      };

      const res = await request(getServer(app))
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', 'invalid-signature')
        .send(body);

      expect(res.status).toBe(401);
    });
  });
});
