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

describe('DELETE /api/v1/items/:id', () => {
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

    for (const sigle of ['TS-ID', 'TS-ID2']) {
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
      name: 'School Delete Item',
      sigle: 'TS-ID',
      address: '1 Delete Item Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School ID',
      sigle: 'TS-ID2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminID',
      phone: '+2250100000750',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Inès',
      lastName: 'Konan',
      phone: '+2250100000751',
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
      shopName: 'Snack Inès',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorID',
      phone: '+2250100000752',
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
      shopName: 'Other Snack ID',
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
      '+2250100000750',
      '+2250100000751',
      '+2250100000752',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should delete item for own VENDOR and return 204', async () => {
      const item = await itemRepo.save({
        vendorId: vendor.id,
        name: 'Kedjénou',
        price: 1200,
        status: ItemStatus.ACTIVE,
      });

      const res = await request(getServer(app))
        .delete(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ownVendorToken}`);

      expect(res.status).toBe(204);
      const deleted = await itemRepo.findOne({ where: { id: item.id } });
      expect(deleted).toBeNull();
    });

    it('should delete item for SUPER_ADMIN and return 204', async () => {
      const item = await itemRepo.save({
        vendorId: vendor.id,
        name: 'Placali',
        price: 500,
        status: ItemStatus.ACTIVE,
      });

      const res = await request(getServer(app))
        .delete(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(204);
      const deleted = await itemRepo.findOne({ where: { id: item.id } });
      expect(deleted).toBeNull();
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const item = await itemRepo.save({
        vendorId: vendor.id,
        name: 'Foutou',
        price: 800,
        status: ItemStatus.ACTIVE,
      });

      const res = await request(getServer(app)).delete(
        `/api/v1/items/${item.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when VENDOR deletes another vendor item', async () => {
      const item = await itemRepo.save({
        vendorId: vendor.id,
        name: 'Garba',
        price: 300,
        status: ItemStatus.ACTIVE,
      });

      const res = await request(getServer(app))
        .delete(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when item does not exist', async () => {
      const res = await request(getServer(app))
        .delete('/api/v1/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
