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

describe('GET /api/v1/withdrawals', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let withdrawalRepo: Repository<Withdrawal>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let otherVendor: Vendor;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let schoolAdminToken: string;

  let withdrawal1: Withdrawal;
  let withdrawal2: Withdrawal;

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

    for (const sigle of ['TS-WL']) {
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
      '+2250100005600',
      '+2250100005601',
      '+2250100005602',
      '+2250100005603',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Withdrawal List',
      sigle: 'TS-WL',
      address: '1 WL St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWL',
      phone: '+2250100005600',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminWL',
      phone: '+2250100005601',
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
      lastName: 'WL',
      phone: '+2250100005602',
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
      shopName: 'Snack WL',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorWL',
      phone: '+2250100005603',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: school.id,
      shopName: 'Other Snack WL',
      status: VendorStatus.ACTIVE,
    });

    withdrawal1 = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 5000,
      currency: Currency.XOF,
      waveNumber: '+2250701111111',
      status: WithdrawalStatus.PENDING,
    });
    withdrawal2 = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 2000,
      currency: Currency.XOF,
      waveNumber: '+2250702222222',
      status: WithdrawalStatus.SUCCESS,
    });
    await withdrawalRepo.save({
      vendorId: otherVendor.id,
      amount: 3000,
      currency: Currency.XOF,
      waveNumber: '+2250703333333',
      status: WithdrawalStatus.PENDING,
    });

    void withdrawal1;
    void withdrawal2;
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await withdrawalRepo.delete({ vendorId: otherVendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: otherVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005600',
      '+2250100005601',
      '+2250100005602',
      '+2250100005603',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all withdrawals as SUPER_ADMIN (3 total)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.meta).toBeDefined();
    });

    it('should return only own withdrawals as VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.data.map(
        (w: { vendorId: string }) => w.vendorId,
      );
      expect(ids.every((id: string) => id === vendor.id)).toBe(true);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should return only own withdrawals as other VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Authorization', `Bearer ${otherVendorToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.data.map(
        (w: { vendorId: string }) => w.vendorId,
      );
      expect(ids.every((id: string) => id === otherVendor.id)).toBe(true);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should respect pagination (limit=1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/withdrawals?page=1&limit=1')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
      expect(res.body.data.meta.totalPages).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/withdrawals');
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/withdrawals')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
