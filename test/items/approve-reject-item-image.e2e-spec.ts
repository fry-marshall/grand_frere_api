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
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('PUT /api/v1/items/:id/image/approve and /reject', () => {
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
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let vendorToken: string;

  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  const createItemWithPendingImage = async () => {
    const item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Alloco',
      price: 500,
      status: ItemStatus.ACTIVE,
    });

    const uploadRes = await request(getServer(app))
      .put(`/api/v1/items/${item.id}/image`)
      .set('Authorization', `Bearer ${vendorToken}`)
      .attach('file', pngBuffer, {
        filename: 'dish.png',
        contentType: 'image/png',
      });

    return {
      itemId: item.id,
      pendingImageUrl: uploadRes.body.data.pendingImageUrl as string,
    };
  };

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    itemRepo = ds.getRepository(Item);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-AIM', 'TS-AIM2']) {
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
      name: 'School Item Approve',
      sigle: 'TS-AIM',
      address: '1 Approve Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School AIM',
      sigle: 'TS-AIM2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminAIM',
      phone: '+2250100000860',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminAIM',
      phone: '+2250100000861',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const otherSchoolAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'SchoolAdminAIM',
      phone: '+2250100000862',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherSchoolAdmin.id,
      role: otherSchoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Pauline',
      lastName: 'AIM',
      phone: '+2250100000863',
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
      shopName: 'Snack Pauline AIM',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await itemRepo.delete({ vendorId: vendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000860',
      '+2250100000861',
      '+2250100000862',
      '+2250100000863',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('PUT /image/approve', () => {
    describe('Success cases', () => {
      it('should let SUPER_ADMIN approve a pending image and move it to imageUrl', async () => {
        const { itemId, pendingImageUrl } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.imageUrl).toBe(pendingImageUrl);
        expect(res.body.data.pendingImageUrl).toBeNull();

        const dbItem = await itemRepo.findOne({ where: { id: itemId } });
        expect(dbItem?.pendingImageUrl).toBeNull();
        expect(dbItem?.imageUrl).not.toBeNull();
      });
    });

    describe('Failure cases', () => {
      it('should return 401 when no token is provided', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app)).put(
          `/api/v1/items/${itemId}/image/approve`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 403 when VENDOR attempts to approve', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/approve`)
          .set('Authorization', `Bearer ${vendorToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when SCHOOL_ADMIN of the same school attempts to approve', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/approve`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when SCHOOL_ADMIN is from another school', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/approve`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when item does not exist', async () => {
        const res = await request(getServer(app))
          .put(
            '/api/v1/items/00000000-0000-0000-0000-000000000000/image/approve',
          )
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });

      it('should return 409 when there is no pending image', async () => {
        const item = await itemRepo.save({
          vendorId: vendor.id,
          name: 'No pending image',
          price: 300,
          status: ItemStatus.ACTIVE,
        });

        const res = await request(getServer(app))
          .put(`/api/v1/items/${item.id}/image/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.ITEMS.NO_PENDING_IMAGE);
      });
    });
  });

  describe('PUT /image/reject', () => {
    describe('Success cases', () => {
      it('should let SUPER_ADMIN reject a pending image and keep the live imageUrl unchanged', async () => {
        const { itemId } = await createItemWithPendingImage();
        await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        const beforeApprove = await itemRepo.findOne({
          where: { id: itemId },
        });
        const liveImageUrl = beforeApprove?.imageUrl;

        await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image`)
          .set('Authorization', `Bearer ${vendorToken}`)
          .attach('file', pngBuffer, {
            filename: 'dish2.png',
            contentType: 'image/png',
          });

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.pendingImageUrl).toBeNull();

        const dbItem = await itemRepo.findOne({ where: { id: itemId } });
        expect(dbItem?.pendingImageUrl).toBeNull();
        expect(dbItem?.imageUrl).toBe(liveImageUrl);
      });
    });

    describe('Failure cases', () => {
      it('should return 401 when no token is provided', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app)).put(
          `/api/v1/items/${itemId}/image/reject`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 403 when VENDOR attempts to reject', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/reject`)
          .set('Authorization', `Bearer ${vendorToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when SCHOOL_ADMIN of the same school attempts to reject', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/reject`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when SCHOOL_ADMIN is from another school', async () => {
        const { itemId } = await createItemWithPendingImage();

        const res = await request(getServer(app))
          .put(`/api/v1/items/${itemId}/image/reject`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when item does not exist', async () => {
        const res = await request(getServer(app))
          .put(
            '/api/v1/items/00000000-0000-0000-0000-000000000000/image/reject',
          )
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });

      it('should return 409 when there is no pending image', async () => {
        const item = await itemRepo.save({
          vendorId: vendor.id,
          name: 'No pending image 2',
          price: 300,
          status: ItemStatus.ACTIVE,
        });

        const res = await request(getServer(app))
          .put(`/api/v1/items/${item.id}/image/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.ITEMS.NO_PENDING_IMAGE);
      });
    });
  });
});
