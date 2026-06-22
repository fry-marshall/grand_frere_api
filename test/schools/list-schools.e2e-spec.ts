import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/schools', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let vendorToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await schoolRepo.delete({ sigle: 'LS-T1' });
    await userRepo.delete({ phone: '+2250100007100' });

    school = await schoolRepo.save({
      name: 'List Schools Test',
      sigle: 'LS-T1',
      address: '1 List St',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'LS',
      phone: '+2250100007100',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
  });

  afterAll(async () => {
    await schoolRepo.delete({ id: school.id });
    await userRepo.delete({ phone: '+2250100007100' });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return 200 with school list when unauthenticated', async () => {
      const res = await request(getServer(app)).get('/api/v1/schools');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(
        res.body.data.some((s: { id: string }) => s.id === school.id),
      ).toBe(true);
    });

    it('should return 200 with school list when authenticated as VENDOR', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return id, name, sigle, address, status, createdAt on each school', async () => {
      const res = await request(getServer(app)).get('/api/v1/schools');

      expect(res.status).toBe(200);
      const found = res.body.data.find(
        (s: { id: string }) => s.id === school.id,
      );
      expect(found).toBeDefined();
      expect(found).toMatchObject({
        id: school.id,
        name: 'List Schools Test',
        sigle: 'LS-T1',
        address: '1 List St',
        status: SchoolStatus.ACTIVE,
      });
      expect(found.createdAt).toBeDefined();
    });
  });
});
