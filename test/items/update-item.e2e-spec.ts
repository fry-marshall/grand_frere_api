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

describe('PUT /api/v1/items/:id', () => {
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

    for (const sigle of ['TS-IU', 'TS-IU2']) {
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
      name: 'School Update Item',
      sigle: 'TS-IU',
      address: '1 Update Item Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School IU',
      sigle: 'TS-IU2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminIU',
      phone: '+2250100000740',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Christelle',
      lastName: 'Aka',
      phone: '+2250100000741',
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
      shopName: 'Snack Christelle',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorIU',
      phone: '+2250100000742',
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
      shopName: 'Other Snack IU',
      status: VendorStatus.ACTIVE,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Riz sauce',
      price: 600,
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
      '+2250100000740',
      '+2250100000741',
      '+2250100000742',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should update name and price for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Riz sauce graine', price: 700 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Riz sauce graine');
      expect(res.body.data.price).toBe(700);
      expect(res.body.data.id).toBe(item.id);
    });

    it('should update status for own VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({ status: ItemStatus.INACTIVE });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ItemStatus.INACTIVE);
    });

    it('should accept partial update', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({ description: 'Avec légumes frais' });

      expect(res.status).toBe(200);
      expect(res.body.data.description).toBe('Avec légumes frais');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR updates another vendor item', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .send({ name: 'Hijack' });
      expect(res.status).toBe(403);
    });

    it('should return 404 when item does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Test' });
      expect(res.status).toBe(404);
    });

    it('should return 400 when price is zero', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .send({ price: 0 });
      expect(res.status).toBe(400);
    });
  });
});
