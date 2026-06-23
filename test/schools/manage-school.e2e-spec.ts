import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('GET/PUT /api/v1/schools', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
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
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-MS', 'TS-OT']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'Test School MS',
      sigle: 'TS-MS',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other School',
      sigle: 'TS-OT',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminMS',
      phone: '+2250100000520',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'Admin',
      phone: '+2250100000521',
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
      lastName: 'Admin',
      phone: '+2250100000522',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });
  });

  afterAll(async () => {
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000520',
      '+2250100000521',
      '+2250100000522',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  const resetSchool = (status: SchoolStatus) =>
    schoolRepo.update(school.id, { status });

  describe('GET /schools', () => {
    describe('Success cases', () => {
      it('should return list of schools for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/schools')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
    });

    describe('Success cases (public endpoint)', () => {
      it('should return 200 without token', async () => {
        const res = await request(getServer(app)).get('/api/v1/schools');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
      });

      it('should return 200 for SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/schools')
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);
        expect(res.status).toBe(200);
      });
    });
  });

  describe('GET /schools/:id', () => {
    describe('Success cases', () => {
      it('should return school for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/schools/${school.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(school.id);
      });

      it('should return own school for SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/schools/${school.id}`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(school.id);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when SCHOOL_ADMIN accesses another school', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/schools/${school.id}`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when school does not exist', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/schools/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /schools/:id', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to update school name and address', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: 'Updated School Name', address: '99 Updated Street' });

        expect(res.status).toBe(200);
        expect(res.body.data.name).toBe('Updated School Name');
        expect(res.body.data.sigle).toBe('TS-MS');
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`)
          .send({ name: 'Hacked Name' });
        expect(res.status).toBe(403);
      });

      it('should return 404 when school does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/schools/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ name: 'Ghost School' });
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /schools/:id/suspend', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to suspend an active school', async () => {
        await resetSchool(SchoolStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(SchoolStatus.SUSPENDED);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetSchool(SchoolStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/suspend`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 409 when school is already SUSPENDED', async () => {
        await resetSchool(SchoolStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.SCHOOLS.NOT_SUSPENDABLE);
      });

      it('should return 404 when school does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/schools/00000000-0000-0000-0000-000000000000/suspend')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /schools/:id/activate', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to reactivate a suspended school', async () => {
        await resetSchool(SchoolStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(SchoolStatus.ACTIVE);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        await resetSchool(SchoolStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/activate`)
          .set('Authorization', `Bearer ${ownSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 409 when school is already ACTIVE', async () => {
        await resetSchool(SchoolStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/schools/${school.id}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.SCHOOLS.NOT_ACTIVATABLE);
      });

      it('should return 404 when school does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/schools/00000000-0000-0000-0000-000000000000/activate')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });
});
