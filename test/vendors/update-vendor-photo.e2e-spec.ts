import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';

describe('PUT /api/v1/vendors/:id/photo', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let ownVendorToken: string;
  let otherVendorToken: string;

  const phones = ['+2250100009400', '+2250100009401'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-VP' } });
    if (leftover) {
      await vendorRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    for (const phone of phones) await userRepo.delete({ phone });

    school = await schoolRepo.save({
      name: 'School Vendor Photo',
      sigle: 'TS-VP',
      address: '1 Rue Photo',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Awa',
      lastName: 'Sanogo',
      phone: phones[0],
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
      shopName: 'Kiosque Awa',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Boubacar',
      lastName: 'Diarra',
      phone: phones[1],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: school.id,
      shopName: 'Kiosque Boubacar',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of phones) await userRepo.delete({ phone });
    await app.close();
  });

  describe('Success cases', () => {
    it('should upload the photo and return a working URL', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/vendors/${vendor.id}/photo`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', Buffer.from('fake-image-content'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.photoUrl).toMatch(/^http:\/\/localhost\/storage\//);

      const dbVendor = await vendorRepo.findOne({ where: { id: vendor.id } });
      expect(dbVendor?.photoUrl).not.toContain('/');
      expect(dbVendor?.photoUrl).toMatch(/\.jpeg$/);
    });

    it('should delete the old photo file when replaced', async () => {
      const first = await request(getServer(app))
        .put(`/api/v1/vendors/${vendor.id}/photo`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', Buffer.from('first-image'), {
          filename: 'first.jpg',
          contentType: 'image/jpeg',
        });
      const firstFilename = first.body.data.photoUrl.split('/').pop();

      const second = await request(getServer(app))
        .put(`/api/v1/vendors/${vendor.id}/photo`)
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', Buffer.from('second-image'), {
          filename: 'second.jpg',
          contentType: 'image/jpeg',
        });

      expect(second.status).toBe(200);
      expect(second.body.data.photoUrl.split('/').pop()).not.toBe(
        firstFilename,
      );
    });
  });

  describe('Failure cases', () => {
    it('should return 403 when a different vendor tries to update the photo', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/vendors/${vendor.id}/photo`)
        .set('Authorization', `Bearer ${otherVendorToken}`)
        .attach('file', Buffer.from('fake-image-content'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/vendors/00000000-0000-0000-0000-000000000000/photo')
        .set('Authorization', `Bearer ${ownVendorToken}`)
        .attach('file', Buffer.from('fake-image-content'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });
      expect(res.status).toBe(404);
    });
  });
});
