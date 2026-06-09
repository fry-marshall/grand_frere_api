import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('POST /api/v1/cards', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let superAdminToken: string;
  let schoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-CB' } });
    if (leftover) {
      await cardRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School CB',
      sigle: 'TS-CB',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+2250100000090',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'Admin',
      phone: '+2250100000091',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });
  });

  afterAll(async () => {
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ phone: '+2250100000090' });
    await userRepo.delete({ phone: '+2250100000091' });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should generate the requested number of cards with QR codes', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: school.id, count: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveLength(5);

      for (const card of res.body.data) {
        expect(card.code).toMatch(/^GF-TS-CB-\d{4}$/);
        expect(card.status).toBe(CardStatus.UNASSIGNED);
        expect(card.schoolId).toBe(school.id);
        expect(card.dailyLimit).toBe(1000);
        expect(card.imageUrl).toBeDefined();
        expect(card.studentId).toBeNull();
      }

      const codes = (res.body.data as Array<{ code: string }>).map(
        (c) => c.code,
      );
      expect(new Set(codes).size).toBe(5);
    });

    it('should generate cards with unique codes across multiple batches', async () => {
      const res1 = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: school.id, count: 3 });

      const res2 = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: school.id, count: 3 });

      const codes1 = (res1.body.data as Array<{ code: string }>).map(
        (c) => c.code,
      );
      const codes2 = (res2.body.data as Array<{ code: string }>).map(
        (c) => c.code,
      );
      const allCodes = [...codes1, ...codes2];
      expect(new Set(allCodes).size).toBe(6);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when count is missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: school.id });

      expect(res.status).toBe(400);
    });

    it('should return 400 when count exceeds 100', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: school.id, count: 101 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when schoolId is not a valid UUID', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: 'not-a-uuid', count: 5 });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .send({ schoolId: school.id, count: 5 });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ schoolId: school.id, count: 5 });

      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ schoolId: '00000000-0000-0000-0000-000000000000', count: 5 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(ErrorMessages.SCHOOLS.NOT_FOUND);
    });
  });
});
