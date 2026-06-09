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

describe('POST /api/v1/schools and POST /api/v1/schools/:id/admin', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let superAdminToken: string;
  let schoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminCS',
      phone: '+2250100000510',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const existingSchool = await schoolRepo.save({
      name: 'Existing School',
      sigle: 'EXST',
      address: '1 Existing Street',
      status: SchoolStatus.ACTIVE,
    });
    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminCS',
      phone: '+2250100000511',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: existingSchool.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });
  });

  afterAll(async () => {
    const leftover = await schoolRepo.find({
      where: [{ sigle: 'LMC' }, { sigle: 'EXST' }, { sigle: 'DUPE' }],
    });
    for (const s of leftover) {
      await userRepo.delete({ schoolId: s.id });
      await schoolRepo.delete({ id: s.id });
    }
    for (const phone of [
      '+2250100000510',
      '+2250100000511',
      '+2250105000001',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('POST /schools', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to create a school', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            name: 'Lycée Moderne de Cocody',
            sigle: 'LMC',
            address: '12 Rue des Jardins, Cocody',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.sigle).toBe('LMC');
        expect(res.body.data.status).toBe(SchoolStatus.ACTIVE);
      });
    });

    describe('Failure cases', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .send({ name: 'Test', sigle: 'TST', address: '1 Test Street' });
        expect(res.status).toBe(401);
      });

      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .set('Authorization', `Bearer ${schoolAdminToken}`)
          .send({ name: 'Test', sigle: 'TST', address: '1 Test Street' });
        expect(res.status).toBe(403);
      });

      it('should return 400 when name is missing', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ sigle: 'TST', address: '1 Test Street' });
        expect(res.status).toBe(400);
      });

      it('should return 400 when sigle format is invalid', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            name: 'Test',
            sigle: 'invalid sigle',
            address: '1 Test Street',
          });
        expect(res.status).toBe(400);
      });

      it('should return 409 when sigle already exists', async () => {
        await schoolRepo.save({
          name: 'Duplicate School',
          sigle: 'DUPE',
          address: '1 Dupe Street',
          status: SchoolStatus.ACTIVE,
        });

        const res = await request(getServer(app))
          .post('/api/v1/schools')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            name: 'Another School',
            sigle: 'DUPE',
            address: '2 Dupe Street',
          });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOLS.SIGLE_ALREADY_EXISTS,
        );
      });
    });
  });

  describe('POST /schools/:id/admin', () => {
    let schoolId: string;

    beforeAll(async () => {
      const school = await schoolRepo.findOne({ where: { sigle: 'LMC' } });
      schoolId = school!.id;
    });

    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to create a school admin', async () => {
        const res = await request(getServer(app))
          .post(`/api/v1/schools/${schoolId}/admin`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            firstName: 'Kouamé',
            lastName: 'Assi',
            phone: '+2250105000001',
            password: 'SecurePass123',
          });

        expect(res.status).toBe(201);
        expect(res.body.data.role).toBe(UserRole.SCHOOL_ADMIN);
        expect(res.body.data.schoolId).toBe(schoolId);
        expect(res.body.data).not.toHaveProperty('passwordHash');
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when user is SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .post(`/api/v1/schools/${schoolId}/admin`)
          .set('Authorization', `Bearer ${schoolAdminToken}`)
          .send({
            firstName: 'A',
            lastName: 'B',
            phone: '+2250105000002',
            password: 'Pass123456',
          });
        expect(res.status).toBe(403);
      });

      it('should return 404 when school does not exist', async () => {
        const res = await request(getServer(app))
          .post('/api/v1/schools/00000000-0000-0000-0000-000000000000/admin')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            firstName: 'A',
            lastName: 'B',
            phone: '+2250105000003',
            password: 'Pass123456',
          });
        expect(res.status).toBe(404);
      });

      it('should return 400 when password is too short', async () => {
        const res = await request(getServer(app))
          .post(`/api/v1/schools/${schoolId}/admin`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            firstName: 'A',
            lastName: 'B',
            phone: '+2250105000004',
            password: '123',
          });
        expect(res.status).toBe(400);
      });

      it('should return 409 when phone already exists', async () => {
        const res = await request(getServer(app))
          .post(`/api/v1/schools/${schoolId}/admin`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({
            firstName: 'Another',
            lastName: 'Admin',
            phone: '+2250105000001',
            password: 'SecurePass123',
          });
        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
      });
    });
  });
});
