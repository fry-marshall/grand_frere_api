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

describe('GET/PUT/DELETE /api/v1/vendors', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
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
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-MV', 'TS-MV2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Manage Vendor',
      sigle: 'TS-MV',
      address: '1 Manage Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other School MV',
      sigle: 'TS-MV2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminMV',
      phone: '+2250100000580',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminMV',
      phone: '+2250100000581',
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
      lastName: 'AdminMV',
      phone: '+2250100000582',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Amara',
      lastName: 'Touré',
      phone: '+2250100000583',
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
      shopName: 'Kiosque Amara',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Kofi',
      lastName: 'Mensah',
      phone: '+2250100000584',
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
      shopName: 'Kiosque Kofi',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000580',
      '+2250100000581',
      '+2250100000582',
      '+2250100000583',
      '+2250100000584',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('GET /vendors', () => {
    describe('Success cases', () => {
      it('should return all vendors for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/vendors')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.data)).toBe(true);
        expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      });

      it('should return only own-school vendors for SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/vendors')
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

        expect(res.status).toBe(200);
        const vendors = res.body.data.data as { schoolId: string }[];
        expect(vendors.every((v) => v.schoolId === school.id)).toBe(true);
      });
    });

    describe('Failure cases', () => {
      it('should return 401 when no token', async () => {
        const res = await request(getServer(app)).get('/api/v1/vendors');
        expect(res.status).toBe(401);
      });

      it('should return 403 when user is VENDOR', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/vendors')
          .set('Authorization', `Bearer ${ownVendorToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('GET /vendors/:id', () => {
    describe('Success cases', () => {
      it('should return vendor for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(vendor.id);
      });

      it('should return vendor for own SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(vendor.id);
      });

      it('should return own vendor for VENDOR', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownVendorToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(vendor.id);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when SCHOOL_ADMIN accesses another school vendor', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when VENDOR accesses another vendor', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${otherVendorToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /vendors/:id', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to update vendor', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ shopName: 'Kiosque Updated' });

        expect(res.status).toBe(200);
        expect(res.body.data.shopName).toBe('Kiosque Updated');
      });

      it('should allow own VENDOR to update their shop', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownVendorToken}`)
          .send({ waveNumber: '+2250707000099' });

        expect(res.status).toBe(200);
        expect(res.body.data.waveNumber).toBe('+2250707000099');
      });

      it('should update opening and closing hours', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownVendorToken}`)
          .send({ openingTime: '08:00', closingTime: '17:00' });

        expect(res.status).toBe(200);
        expect(res.body.data.openingTime).toBe('08:00');
        expect(res.body.data.closingTime).toBe('17:00');
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when VENDOR updates another vendor', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${otherVendorToken}`)
          .send({ shopName: 'Hacked' });
        expect(res.status).toBe(403);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/vendors/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ shopName: 'Ghost' });
        expect(res.status).toBe(404);
      });

      it('should return 400 when openingTime format is invalid', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownVendorToken}`)
          .send({ openingTime: '8h00' });
        expect(res.status).toBe(400);
      });

      it('should return 400 when closingTime format is invalid', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownVendorToken}`)
          .send({ closingTime: '17:00:00' });
        expect(res.status).toBe(400);
      });
    });
  });

  describe('DELETE /vendors/:id', () => {
    let deleteVendorId: string;

    beforeAll(async () => {
      const existing = await userRepo.findOne({
        where: { phone: '+2250100000585' },
      });
      if (existing) {
        await vendorRepo.delete({ userId: existing.id });
        await userRepo.delete({ id: existing.id });
      }
      const u = await userRepo.save({
        firstName: 'ToDelete',
        lastName: 'Vendor',
        phone: '+2250100000585',
        role: UserRole.VENDOR,
        isOnboarded: true,
      });
      const v = await vendorRepo.save({
        userId: u.id,
        schoolId: school.id,
        shopName: 'To Delete Shop',
        status: VendorStatus.PENDING,
      });
      deleteVendorId = v.id;
    });

    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to delete a vendor', async () => {
        const res = await request(getServer(app))
          .delete(`/api/v1/vendors/${deleteVendorId}`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(204);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .delete(`/api/v1/vendors/${vendor.id}`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(getServer(app))
          .delete('/api/v1/vendors/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });
});
