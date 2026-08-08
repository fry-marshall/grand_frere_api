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

describe('GET /api/v1/withdrawals/:id', () => {
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
  let withdrawal: Withdrawal;

  let superAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;

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

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-WGO' } });
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

    school = await schoolRepo.save({
      name: 'School Withdrawal Get',
      sigle: 'TS-WGO',
      address: '1 WGO St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWGO',
      phone: '+2250100005610',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Salif',
      lastName: 'WGO',
      phone: '+2250100005611',
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
      shopName: 'Snack WGO',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorWGO',
      phone: '+2250100005612',
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
      shopName: 'Other Snack WGO',
      status: VendorStatus.ACTIVE,
    });

    withdrawal = await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 4000,
      currency: Currency.XOF,
      waveNumber: '+2250701234567',
      status: WithdrawalStatus.PENDING,
    });
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorWalletRepo.delete({ vendorId: otherVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100005610',
      '+2250100005611',
      '+2250100005612',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return withdrawal details for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/withdrawals/${withdrawal.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(withdrawal.id);
      expect(res.body.data.amount).toBe(4000);
      expect(res.body.data.vendor.shopName).toBe('Snack WGO');
      expect(res.body.data.school.id).toBe(school.id);
    });

    it('should return withdrawal details for the owning VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/withdrawals/${withdrawal.id}`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(withdrawal.id);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/withdrawals/${withdrawal.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when accessed by another VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/withdrawals/${withdrawal.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when withdrawal does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/withdrawals/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
