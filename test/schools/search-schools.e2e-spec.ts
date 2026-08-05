import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/schools/search', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let activeSchool: School;
  let suspendedSchool: School;
  let superAdminToken: string;
  let schoolAdminToken: string;

  const sigles = ['SRCH-ACT', 'SRCH-SUS'];
  const phones = ['+2250100007200', '+2250100007201'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of sigles) {
      await schoolRepo.delete({ sigle });
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    activeSchool = await schoolRepo.save({
      name: 'Search Cocody Active',
      sigle: sigles[0],
      address: '1 Search St',
      status: SchoolStatus.ACTIVE,
    });

    suspendedSchool = await schoolRepo.save({
      name: 'Search Yopougon Suspended',
      sigle: sigles[1],
      address: '2 Search St',
      status: SchoolStatus.SUSPENDED,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSearch',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminSearch',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: activeSchool.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });
  });

  afterAll(async () => {
    for (const sigle of sigles) {
      const school = await schoolRepo.findOne({ where: { sigle } });
      if (school) {
        await userRepo.delete({ schoolId: school.id });
        await schoolRepo.delete({ id: school.id });
      }
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return paginated schools with meta', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/search')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.meta).toMatchObject({ page: 1, limit: 20 });
      expect(typeof res.body.data.meta.total).toBe('number');
    });

    it('should filter by search matching the name', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/search?search=Cocody')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.data.some(
          (s: { id: string }) => s.id === activeSchool.id,
        ),
      ).toBe(true);
      expect(
        res.body.data.data.every(
          (s: { id: string }) => s.id !== suspendedSchool.id,
        ),
      ).toBe(true);
    });

    it('should filter by search matching the sigle', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/search?search=${sigles[1]}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.data.some(
          (s: { id: string }) => s.id === suspendedSchool.id,
        ),
      ).toBe(true);
    });

    it('should filter by status', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/search?status=SUSPENDED')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.data.every(
          (s: { status: string }) => s.status === 'SUSPENDED',
        ),
      ).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 without a token', async () => {
      const res = await request(getServer(app)).get('/api/v1/schools/search');
      expect(res.status).toBe(401);
    });

    it('should return 403 for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/search')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
