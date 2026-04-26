import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Withdrawal } from '../../src/modules/withdrawals/entities/withdrawal.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { WithdrawalStatus } from '../../src/modules/withdrawals/withdrawal.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('GET /api/v1/vendors/:id/withdrawals', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let withdrawalRepo: Repository<Withdrawal>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let ownVendorToken: string;
  let otherVendorToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    withdrawalRepo = ds.getRepository(Withdrawal);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-VW', 'TS-VW2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await withdrawalRepo
          .createQueryBuilder()
          .delete()
          .where(
            'vendorId IN (SELECT id FROM vendors WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Vendor Withdrawals',
      sigle: 'TS-VW',
      address: '1 Withdrawal Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School VW',
      sigle: 'TS-VW2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminVW',
      phone: '+2250100000610',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminVW',
      phone: '+2250100000611',
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
      lastName: 'AdminVW',
      phone: '+2250100000612',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Kouassi',
      lastName: 'Koffi',
      phone: '+2250100000613',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    ownVendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack Kouassi',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorVW',
      phone: '+2250100000614',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    const otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Snack VW',
      status: VendorStatus.ACTIVE,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });

    await withdrawalRepo.save({
      vendorId: vendor.id,
      amount: 5000,
      currency: Currency.XOF,
      waveNumber: '+2250700000001',
      status: WithdrawalStatus.SUCCESS,
    });

    void otherVendor;
  });

  afterAll(async () => {
    await withdrawalRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000610',
      '+2250100000611',
      '+2250100000612',
      '+2250100000613',
      '+2250100000614',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return withdrawals for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/withdrawals`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].amount).toBe(5000);
      expect(res.body.data.data[0].currency).toBe(Currency.XOF);
      expect(res.body.data.data[0].status).toBe(WithdrawalStatus.SUCCESS);
      expect(res.body.data.meta.total).toBe(1);
    });

    it('should return withdrawals for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/withdrawals`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should return withdrawals for own VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/withdrawals`)
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should return empty list for vendor with no withdrawals', async () => {
      const emptyVendor = await vendorRepo.findOne({
        where: { schoolId: otherSchool.id },
      });
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${emptyVendor!.id}/withdrawals`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/vendors/${vendor.id}/withdrawals`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school vendor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/withdrawals`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor withdrawals', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/withdrawals`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000/withdrawals')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
