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

describe('POST /api/v1/withdrawals/vendor/:vendorId', () => {
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
  let vendorWallet: VendorWallet;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let schoolAdminToken: string;

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

    for (const sigle of ['TS-WD']) {
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
      '+2250100005500',
      '+2250100005501',
      '+2250100005502',
      '+2250100005503',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Withdrawal',
      sigle: 'TS-WD',
      address: '1 Withdrawal St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWD',
      phone: '+2250100005500',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminWD',
      phone: '+2250100005501',
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
      lastName: 'WD',
      phone: '+2250100005502',
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
      shopName: 'Snack WD',
      status: VendorStatus.ACTIVE,
    });
    vendorWallet = await vendorWalletRepo.save({
      vendorId: vendor.id,
      balance: 10000,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorWD',
      phone: '+2250100005503',
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
      shopName: 'Other Snack WD',
      status: VendorStatus.ACTIVE,
    });

    void otherVendor;
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await withdrawalRepo.delete({ vendorId: otherVendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: otherVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005500',
      '+2250100005501',
      '+2250100005502',
      '+2250100005503',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should create a withdrawal as VENDOR and debit vendor wallet', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ amount: 3000, waveNumber: '+2250701234567' });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.vendorId).toBe(vendor.id);
      expect(res.body.data.amount).toBe(3000);
      expect(res.body.data.waveNumber).toBe('+2250701234567');
      expect(res.body.data.status).toBe(WithdrawalStatus.PENDING);

      const updatedWallet = await vendorWalletRepo.findOne({
        where: { id: vendorWallet.id },
      });
      expect(updatedWallet!.balance).toBe(7000);
    });

    it('should create a withdrawal as SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ amount: 1000, waveNumber: '+2250701234568' });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(WithdrawalStatus.PENDING);

      const updatedWallet = await vendorWalletRepo.findOne({
        where: { id: vendorWallet.id },
      });
      expect(updatedWallet!.balance).toBe(6000);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .send({ amount: 1000, waveNumber: '+2250701234567' });
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ amount: 1000, waveNumber: '+2250701234567' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR calls for another vendor', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .send({ amount: 1000, waveNumber: '+2250701234567' });
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/withdrawals/vendor/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ amount: 1000, waveNumber: '+2250701234567' });
      expect(res.status).toBe(404);
    });

    it('should return 400 when balance is insufficient', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/withdrawals/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ amount: 999999, waveNumber: '+2250701234567' });
      expect(res.status).toBe(400);
    });
  });
});
