import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';

describe('GET /api/v1/items', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let itemRepo: Repository<Item>;
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
    itemRepo = ds.getRepository(Item);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-IL', 'TS-IL2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await itemRepo
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
      name: 'School Items List',
      sigle: 'TS-IL',
      address: '1 Items Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School IL',
      sigle: 'TS-IL2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminIL',
      phone: '+2250100000710',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminIL',
      phone: '+2250100000711',
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
      lastName: 'AdminIL',
      phone: '+2250100000712',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Marcelline',
      lastName: 'Kouassi',
      phone: '+2250100000713',
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
      shopName: 'Snack Marcelline',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorIL',
      phone: '+2250100000714',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Snack IL',
      status: VendorStatus.ACTIVE,
    });

    await itemRepo.save([
      {
        vendorId: vendor.id,
        name: 'Sandwich',
        price: 500,
        status: ItemStatus.ACTIVE,
      },
      {
        vendorId: vendor.id,
        name: 'Jus de goyave',
        price: 300,
        status: ItemStatus.ACTIVE,
      },
    ]);
  });

  afterAll(async () => {
    await itemRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000710',
      '+2250100000711',
      '+2250100000712',
      '+2250100000713',
      '+2250100000714',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all items for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should return only own school items for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
      const items = res.body.data.data as { vendorId: string }[];
      expect(items.every((i) => i.vendorId === vendor.id)).toBe(true);
    });

    it('should return empty list for SCHOOL_ADMIN with no vendors', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should return only own items for VENDOR', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
    });

    it('should return empty list for VENDOR with no items', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${otherVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
    });

    it('should support pagination', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items?page=1&limit=1')
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.totalPages).toBe(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/items');
      expect(res.status).toBe(401);
    });

    it('should return 403 when STUDENT role', async () => {
      const studentUser = await userRepo.save({
        firstName: 'Test',
        lastName: 'StudentIL',
        phone: '+2250100000715',
        role: UserRole.STUDENT,
        isOnboarded: true,
      });
      const token = jwtService.sign({
        sub: studentUser.id,
        role: UserRole.STUDENT,
      });
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${token}`);
      await userRepo.delete({ id: studentUser.id });
      expect(res.status).toBe(403);
    });
  });
});
