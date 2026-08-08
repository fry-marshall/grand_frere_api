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

describe('GET /api/v1/withdrawals/stats', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let withdrawalRepo: Repository<Withdrawal>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherSchoolVendor: Vendor;

  let superAdminToken: string;
  let vendorToken: string;

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

    for (const sigle of ['TS-WST', 'TS-WST2']) {
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

    school = await schoolRepo.save({
      name: 'School Withdrawal Stats',
      sigle: 'TS-WST',
      address: '1 WST St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School WST',
      sigle: 'TS-WST2',
      address: '2 WST St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWST',
      phone: '+2250100005620',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Adama',
      lastName: 'WST',
      phone: '+2250100005621',
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
      shopName: 'Snack WST',
      status: VendorStatus.ACTIVE,
    });

    const otherSchoolVendorUser = await userRepo.save({
      firstName: 'Kader',
      lastName: 'WST2',
      phone: '+2250100005622',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherSchoolVendor = await vendorRepo.save({
      userId: otherSchoolVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Snack WST2',
      status: VendorStatus.ACTIVE,
    });

    await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 5000,
      currency: Currency.XOF,
      waveNumber: '+2250701111111',
      status: WithdrawalStatus.PENDING,
    });
    await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 2000,
      currency: Currency.XOF,
      waveNumber: '+2250702222222',
      status: WithdrawalStatus.PENDING,
    });
    await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 9999,
      currency: Currency.XOF,
      waveNumber: '+2250703333333',
      status: WithdrawalStatus.SUCCESS,
    });
    await withdrawalRepo.save({
      vendorId: otherSchoolVendor.id,
      amount: 1000,
      currency: Currency.XOF,
      waveNumber: '+2250704444444',
      status: WithdrawalStatus.PENDING,
    });
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await withdrawalRepo.delete({ vendorId: otherSchoolVendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: otherSchoolVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    for (const phone of [
      '+2250100005620',
      '+2250100005621',
      '+2250100005622',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return counts and amounts grouped by status, network-wide', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/withdrawals/stats')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const byStatus = res.body.data.byStatus as {
        status: WithdrawalStatus;
        count: number;
        amount: number;
      }[];
      const pending = byStatus.find(
        (s) => s.status === WithdrawalStatus.PENDING,
      );
      const success = byStatus.find(
        (s) => s.status === WithdrawalStatus.SUCCESS,
      );
      expect(pending?.count).toBeGreaterThanOrEqual(3);
      expect(pending?.amount).toBeGreaterThanOrEqual(8000);
      expect(success?.count).toBeGreaterThanOrEqual(1);
      expect(success?.amount).toBeGreaterThanOrEqual(9999);
    });

    it('should scope stats to a school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/withdrawals/stats?schoolId=${school.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const byStatus = res.body.data.byStatus as {
        status: WithdrawalStatus;
        count: number;
        amount: number;
      }[];
      const pending = byStatus.find(
        (s) => s.status === WithdrawalStatus.PENDING,
      );
      const success = byStatus.find(
        (s) => s.status === WithdrawalStatus.SUCCESS,
      );
      expect(pending?.count).toBe(2);
      expect(pending?.amount).toBe(7000);
      expect(success?.count).toBe(1);
      expect(success?.amount).toBe(9999);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        '/api/v1/withdrawals/stats',
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR calls this endpoint', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/withdrawals/stats')
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });
  });
});
