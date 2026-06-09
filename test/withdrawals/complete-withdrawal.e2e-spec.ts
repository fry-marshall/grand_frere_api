import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
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

describe('PUT /api/v1/withdrawals/:id/complete', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let withdrawalRepo: Repository<Withdrawal>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;

  let superAdminToken: string;
  let vendorToken: string;
  let schoolAdminToken: string;

  let inProgressWithdrawal: Withdrawal;
  let pendingWithdrawal: Withdrawal;

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

    for (const sigle of ['TS-WC']) {
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
      '+2250100005800',
      '+2250100005801',
      '+2250100005802',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Withdrawal Complete',
      sigle: 'TS-WC',
      address: '1 WC St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWC',
      phone: '+2250100005800',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminWC',
      phone: '+2250100005801',
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
      lastName: 'WC',
      phone: '+2250100005802',
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
      shopName: 'Snack WC',
      status: VendorStatus.ACTIVE,
    });

    inProgressWithdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 5000,
      currency: Currency.XOF,
      waveNumber: '+2250701111111',
      status: WithdrawalStatus.IN_PROGRESS,
    });
    pendingWithdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 2000,
      currency: Currency.XOF,
      waveNumber: '+2250702222222',
      status: WithdrawalStatus.PENDING,
    });
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005800',
      '+2250100005801',
      '+2250100005802',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should mark an IN_PROGRESS withdrawal as SUCCESS as SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/withdrawals/${inProgressWithdrawal.id}/complete`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(inProgressWithdrawal.id);
      expect(res.body.data.status).toBe(WithdrawalStatus.SUCCESS);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).put(
        `/api/v1/withdrawals/${inProgressWithdrawal.id}/complete`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR calls this endpoint', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/withdrawals/${inProgressWithdrawal.id}/complete`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/withdrawals/${inProgressWithdrawal.id}/complete`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when withdrawal does not exist', async () => {
      const res = await request(getServer(app))
        .put(
          '/api/v1/withdrawals/00000000-0000-0000-0000-000000000000/complete',
        )
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when withdrawal is not IN_PROGRESS', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/complete`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
