import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';

describe('GET /api/v1/schools/:id/vendors', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SV', 'TS-SV2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Vendors Test',
      sigle: 'TS-SV',
      address: '1 Vendor Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other School SV',
      sigle: 'TS-SV2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSV',
      phone: '+2250100000530',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSV',
      phone: '+2250100000531',
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
      lastName: 'AdminSV',
      phone: '+2250100000532',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'One',
      phone: '+2250100000533',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack du Coin',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000530',
      '+2250100000531',
      '+2250100000532',
      '+2250100000533',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return vendors list for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].shopName).toBe('Snack du Coin');
      expect(res.body.data.data[0].user).toBeDefined();
      expect(res.body.data.data[0].user.firstName).toBe('Vendor');
      expect(res.body.data.meta.total).toBe(1);
    });

    it('should return vendors list for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
    });

    it('should return empty list for school with no vendors', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${otherSchool.id}/vendors`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should respect pagination params', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${school.id}/vendors?page=1&limit=5`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(5);
      expect(res.body.data.meta.page).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/schools/${school.id}/vendors`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/schools/00000000-0000-0000-0000-000000000000/vendors')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when pagination params are invalid', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schools/${school.id}/vendors?page=0`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
