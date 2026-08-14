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

describe('PUT /api/v1/items/:id/image', () => {
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

  // Minimal 1x1 PNG buffer for tests
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    itemRepo = ds.getRepository(Item);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-IIM', 'TS-IIM2']) {
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
      name: 'School Item Image',
      sigle: 'TS-IIM',
      address: '1 Image Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School IIM',
      sigle: 'TS-IIM2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminIIM',
      phone: '+2250100000760',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Pauline',
      lastName: 'Gnagne',
      phone: '+2250100000761',
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
      shopName: 'Snack Pauline',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorIIM',
      phone: '+2250100000762',
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
      shopName: 'Other Snack IIM',
      status: VendorStatus.ACTIVE,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Soupe kansiyé',
      price: 900,
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
      '+2250100000760',
      '+2250100000761',
      '+2250100000762',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should upload image for own VENDOR and return imageUrl', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', pngBuffer, {
          filename: 'dish.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toBeDefined();
      expect(res.body.data.imageUrl).not.toBeNull();
      expect(res.body.data.imageUrl).toMatch(/^http:\/\/localhost\/storage\//);
      expect(res.body.data.id).toBe(item.id);

      const dbItem = await itemRepo.findOne({ where: { id: item.id } });
      expect(dbItem?.imageUrl).not.toContain('/');
      expect(dbItem?.imageUrl).toMatch(/\.png$/);
    });

    it('should upload image for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', pngBuffer, {
          filename: 'dish2.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toBeDefined();
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .attach('file', pngBuffer, {
          filename: 'dish.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR uploads for another vendor item', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .attach('file', pngBuffer, {
          filename: 'dish.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(403);
    });

    it('should return 400 when no file attached', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .set('Authorization', `Bearer ${ownVendorToken}`);
      expect(res.status).toBe(400);
    });

    it('should return 400 when file type is not an image', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}/image`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', Buffer.from('fake pdf content'), {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
    });

    it('should return 404 when item does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/items/00000000-0000-0000-0000-000000000000/image')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', pngBuffer, {
          filename: 'dish.png',
          contentType: 'image/png',
        });
      expect(res.status).toBe(404);
    });
  });
});
