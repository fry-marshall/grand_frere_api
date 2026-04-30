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

describe('PUT /api/v1/withdrawals/:id/process', () => {
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

  let pendingWithdrawal: Withdrawal;
  let inProgressWithdrawal: Withdrawal;

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

    for (const sigle of ['TS-WP']) {
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
      '+2250100005700',
      '+2250100005701',
      '+2250100005702',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Withdrawal Process',
      sigle: 'TS-WP',
      address: '1 WP St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWP',
      phone: '+2250100005700',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminWP',
      phone: '+2250100005701',
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
      lastName: 'WP',
      phone: '+2250100005702',
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
      shopName: 'Snack WP',
      status: VendorStatus.ACTIVE,
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
      amount: 2000,
      currency: Currency.XOF,
      waveNumber: '+2250702222222',
      status: WithdrawalStatus.IN_PROGRESS,
    });
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005700',
      '+2250100005701',
      '+2250100005702',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should mark a PENDING withdrawal as IN_PROGRESS as SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/process`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(pendingWithdrawal.id);
      expect(res.body.data.status).toBe(WithdrawalStatus.IN_PROGRESS);
    });

    it('should accept an optional paystackRef query param', async () => {
      const newPending = await withdrawalRepo.save({
        vendorId: vendor.id,
        amount: 1000,
        currency: Currency.XOF,
        waveNumber: '+2250709999999',
        status: WithdrawalStatus.PENDING,
      });

      const res = await request(app.getHttpServer())
        .put(
          `/api/v1/withdrawals/${newPending.id}/process?paystackRef=PSK-REF-123`,
        )
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(WithdrawalStatus.IN_PROGRESS);
      expect(res.body.data.paystackRef).toBe('PSK-REF-123');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).put(
        `/api/v1/withdrawals/${pendingWithdrawal.id}/process`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/process`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${pendingWithdrawal.id}/process`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when withdrawal does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/withdrawals/00000000-0000-0000-0000-000000000000/process')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when withdrawal is not PENDING', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/withdrawals/${inProgressWithdrawal.id}/process`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
