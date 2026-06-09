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

describe('POST /api/v1/items/vendor/:vendorId', () => {
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

    for (const sigle of ['TS-IC', 'TS-IC2']) {
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
      name: 'School Create Item',
      sigle: 'TS-IC',
      address: '1 Create Item Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School IC',
      sigle: 'TS-IC2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminIC',
      phone: '+2250100000730',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Nadège',
      lastName: 'Brou',
      phone: '+2250100000731',
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
      shopName: 'Snack Nadège',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorIC',
      phone: '+2250100000732',
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
      shopName: 'Other Snack IC',
      status: VendorStatus.ACTIVE,
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
      '+2250100000730',
      '+2250100000731',
      '+2250100000732',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should create item for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Attiéké poisson', price: 1000 });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Attiéké poisson');
      expect(res.body.data.price).toBe(1000);
      expect(res.body.data.vendorId).toBe(vendor.id);
      expect(res.body.data.id).toBeDefined();
    });

    it('should create item for own VENDOR', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({
          name: "Jus d'ananas",
          price: 350,
          description: 'Frais et naturel',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Jus d'ananas");
      expect(res.body.data.description).toBe('Frais et naturel');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .send({ name: 'Test', price: 100 });
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR creates item for another vendor', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .send({ name: 'Test', price: 100 });
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/items/vendor/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Test', price: 100 });
      expect(res.status).toBe(404);
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({ price: 100 });
      expect(res.status).toBe(400);
    });

    it('should return 400 when price is zero or negative', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${vendor.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({ name: 'Test', price: 0 });
      expect(res.status).toBe(400);
    });
  });
});
