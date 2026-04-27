import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';

describe('GET /api/v1/items/:id', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let itemRepo: Repository<Item>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let item: Item;

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

    for (const sigle of ['TS-IGO', 'TS-IGO2']) {
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
      name: 'School Get Item',
      sigle: 'TS-IGO',
      address: '1 Get Item Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School IGO',
      sigle: 'TS-IGO2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminIGO',
      phone: '+2250100000720',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminIGO',
      phone: '+2250100000721',
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
      lastName: 'AdminIGO',
      phone: '+2250100000722',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Jeannine',
      lastName: 'Yao',
      phone: '+2250100000723',
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
      shopName: 'Snack Jeannine',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorIGO',
      phone: '+2250100000724',
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
      shopName: 'Other Snack IGO',
      status: VendorStatus.ACTIVE,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Alloco',
      price: 400,
      status: ItemStatus.ACTIVE,
    });
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
      '+2250100000720',
      '+2250100000721',
      '+2250100000722',
      '+2250100000723',
      '+2250100000724',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return item for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(item.id);
      expect(res.body.data.name).toBe('Alloco');
      expect(res.body.data.price).toBe(400);
      expect(res.body.data.vendorId).toBe(vendor.id);
    });

    it('should return item for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(item.id);
    });

    it('should return item for own VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(item.id);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/items/${item.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses item from another school', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor item', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when item does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
