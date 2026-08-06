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
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('PUT /api/v1/vendors/:id/suspend and /activate', () => {
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

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SAV' } });
    if (leftover) {
      await vendorRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'School Suspend Activate Vendor',
      sigle: 'TS-SAV',
      address: '1 Suspend Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSAV',
      phone: '+2250100000590',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminSAV',
      phone: '+2250100000591',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Salif',
      lastName: 'Coulibaly',
      phone: '+2250100000592',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack Salif',
      status: VendorStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await vendorRepo.delete({ id: vendor.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100000590',
      '+2250100000591',
      '+2250100000592',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('PUT /vendors/:id/suspend', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to suspend an active vendor', async () => {
        await resetVendor(VendorStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(VendorStatus.SUSPENDED);
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when vendor is not ACTIVE', async () => {
        await resetVendor(VendorStatus.PENDING);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_SUSPENDABLE);
      });

      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetVendor(VendorStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/suspend`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
      });

      it('should return 401 when no token', async () => {
        const res = await request(getServer(app)).put(
          `/api/v1/vendors/${vendor.id}/suspend`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/vendors/00000000-0000-0000-0000-000000000000/suspend')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /vendors/:id/activate', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to reactivate a suspended vendor', async () => {
        await resetVendor(VendorStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(VendorStatus.ACTIVE);
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when vendor is not SUSPENDED', async () => {
        await resetVendor(VendorStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVATABLE);
      });

      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetVendor(VendorStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/vendors/${vendor.id}/activate`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
      });

      it('should return 401 when no token', async () => {
        const res = await request(getServer(app)).put(
          `/api/v1/vendors/${vendor.id}/activate`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 404 when vendor does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/vendors/00000000-0000-0000-0000-000000000000/activate')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });
});
