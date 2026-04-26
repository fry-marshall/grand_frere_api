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
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('POST /api/v1/vendors/:id/approve and /reject', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;

  let superAdminToken: string;
  let schoolAdminToken: string;

  const resetVendor = (status: VendorStatus) =>
    vendorRepo.update(vendor.id, { status });

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-AR' } });
    if (leftover) {
      await vendorRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'School Approve Reject',
      sigle: 'TS-AR',
      address: '1 Approve Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminAR',
      phone: '+2250100000570',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminAR',
      phone: '+2250100000571',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Boubacar',
      lastName: 'Diallo',
      phone: '+2250100000572',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack Boubacar',
      status: VendorStatus.PENDING,
    });
  });

  afterAll(async () => {
    await vendorRepo.delete({ id: vendor.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100000570',
      '+2250100000571',
      '+2250100000572',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('POST /vendors/:id/approve', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to approve a pending vendor', async () => {
        await resetVendor(VendorStatus.PENDING);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe(VendorStatus.ACTIVE);
        expect(res.body.data.shopName).toBe('Snack Boubacar');
        expect(res.body.data.user).toBeDefined();
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when vendor is already ACTIVE', async () => {
        await resetVendor(VendorStatus.ACTIVE);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_APPROVABLE);
      });

      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetVendor(VendorStatus.PENDING);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/approve`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
      });

      it('should return 401 when no token', async () => {
        const res = await request(app.getHttpServer()).post(
          `/api/v1/vendors/${vendor.id}/approve`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/vendors/00000000-0000-0000-0000-000000000000/approve')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('POST /vendors/:id/reject', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to reject a pending vendor', async () => {
        await resetVendor(VendorStatus.PENDING);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(201);
        expect(res.body.data.status).toBe(VendorStatus.REJECTED);
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when vendor is already REJECTED', async () => {
        await resetVendor(VendorStatus.REJECTED);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_REJECTABLE);
      });

      it('should return 409 when vendor is already ACTIVE', async () => {
        await resetVendor(VendorStatus.ACTIVE);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
      });

      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetVendor(VendorStatus.PENDING);

        const res = await request(app.getHttpServer())
          .post(`/api/v1/vendors/${vendor.id}/reject`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
      });

      it('should return 401 when no token', async () => {
        const res = await request(app.getHttpServer()).post(
          `/api/v1/vendors/${vendor.id}/reject`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/v1/vendors/00000000-0000-0000-0000-000000000000/reject')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });
});
