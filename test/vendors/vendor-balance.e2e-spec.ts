import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { Currency } from '../../src/common/enums/currency.enum';

describe('GET /api/v1/vendors/:id/balance', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
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
    vendorWalletRepo = ds.getRepository(VendorWallet);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-VB', 'TS-VB2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorWalletRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"vendorId" IN (SELECT id FROM vendors WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Vendor Balance',
      sigle: 'TS-VB',
      address: '1 Balance Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School VB',
      sigle: 'TS-VB2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminVB',
      phone: '+2250100000620',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminVB',
      phone: '+2250100000621',
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
      lastName: 'AdminVB',
      phone: '+2250100000622',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Amani',
      lastName: 'Diallo',
      phone: '+2250100000623',
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
      shopName: 'Snack Amani',
      status: VendorStatus.ACTIVE,
    });

    await vendorWalletRepo.save({
      vendorId: vendor.id,
      balance: 12500,
      currency: Currency.XOF,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorVB',
      phone: '+2250100000624',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    void (await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Snack VB',
      status: VendorStatus.ACTIVE,
    }));
  });

  afterAll(async () => {
    await vendorWalletRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000620',
      '+2250100000621',
      '+2250100000622',
      '+2250100000623',
      '+2250100000624',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return balance for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/balance`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.vendorId).toBe(vendor.id);
      expect(res.body.data.balance).toBe(12500);
      expect(res.body.data.currency).toBe(Currency.XOF);
      expect(res.body.data.updatedAt).toBeDefined();
    });

    it('should return balance for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/balance`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(12500);
    });

    it('should return balance for own VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/balance`)
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.balance).toBe(12500);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/vendors/${vendor.id}/balance`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school vendor', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/balance`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor balance', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/vendors/${vendor.id}/balance`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000/balance')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
