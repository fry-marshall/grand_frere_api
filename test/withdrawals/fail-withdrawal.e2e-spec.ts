import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { Withdrawal } from '../../src/modules/withdrawals/entities/withdrawal.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { WithdrawalStatus } from '../../src/modules/withdrawals/withdrawal.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('PUT /api/v1/withdrawals/:id/fail', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let withdrawalRepo: Repository<Withdrawal>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let vendorWallet: VendorWallet;

  let superAdminToken: string;
  let vendorToken: string;
  let schoolAdminToken: string;

  let pendingWithdrawal: Withdrawal;
  let inProgressWithdrawal: Withdrawal;
  let successWithdrawal: Withdrawal;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    vendorWalletRepo = ds.getRepository(VendorWallet);
    withdrawalRepo = ds.getRepository(Withdrawal);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-WF']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) {
          await withdrawalRepo.delete({ vendorId: v.id });
          await vendorWalletRepo.delete({ vendorId: v.id });
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100005900',
      '+2250100005901',
      '+2250100005902',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Withdrawal Fail',
      sigle: 'TS-WF',
      address: '1 WF St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWF',
      phone: '+2250100005900',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminWF',
      phone: '+2250100005901',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Binta',
      lastName: 'WF',
      phone: '+2250100005902',
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
      shopName: 'Snack WF',
      status: VendorStatus.ACTIVE,
    });
    vendorWallet = await vendorWalletRepo.save({
      vendorId: vendor.id,
      balance: 0,
    });

    pendingWithdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 5000,
      currency: Currency.XOF,
      waveNumber: '+2250701111111',
      status: WithdrawalStatus.PENDING,
    });
    inProgressWithdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 3000,
      currency: Currency.XOF,
      waveNumber: '+2250702222222',
      status: WithdrawalStatus.IN_PROGRESS,
    });
    successWithdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 1000,
      currency: Currency.XOF,
      waveNumber: '+2250703333333',
      status: WithdrawalStatus.SUCCESS,
    });

    void successWithdrawal;
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005900',
      '+2250100005901',
      '+2250100005902',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should fail a PENDING withdrawal and refund vendor wallet', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/fail`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(pendingWithdrawal.id);
      expect(res.body.data.status).toBe(WithdrawalStatus.FAILED);

      const updatedWallet = await vendorWalletRepo.findOne({
        where: { id: vendorWallet.id },
      });
      expect(updatedWallet!.balance).toBe(5000);
    });

    it('should fail an IN_PROGRESS withdrawal and refund vendor wallet', async () => {
      const walletBefore = await vendorWalletRepo.findOne({
        where: { id: vendorWallet.id },
      });
      const balanceBefore = walletBefore!.balance;

      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${inProgressWithdrawal.id}/fail`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WithdrawalStatus.FAILED);

      const updatedWallet = await vendorWalletRepo.findOne({
        where: { id: vendorWallet.id },
      });
      expect(updatedWallet!.balance).toBe(
        balanceBefore + inProgressWithdrawal.amount,
      );
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).put(
        `/api/v1/withdrawals/${pendingWithdrawal.id}/fail`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/fail`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/fail`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when withdrawal does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/withdrawals/00000000-0000-0000-0000-000000000000/fail')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when withdrawal is already SUCCESS', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${successWithdrawal.id}/fail`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
