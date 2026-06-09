import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/parents/me', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let parentRepo: Repository<Parent>;
  let jwtService: JwtService;

  let parent: Parent;
  let parentToken: string;
  let superAdminToken: string;
  let schoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    parentRepo = ds.getRepository(Parent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [
      '+2250100000770',
      '+2250100000771',
      '+2250100000772',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        if (u.role === UserRole.PARENT)
          await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }

    const school = await schoolRepo.save({
      name: 'School GetMe',
      sigle: 'TS-GM',
      address: '1 GetMe Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminGM',
      phone: '+2250100000770',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminGM',
      phone: '+2250100000771',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Aminata',
      lastName: 'Koné',
      phone: '+2250100000772',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    parent = await parentRepo.save({ userId: parentUser.id });
  });

  afterAll(async () => {
    const leftoverSchool = await schoolRepo.findOne({
      where: { sigle: 'TS-GM' },
    });
    if (leftoverSchool) {
      await userRepo.delete({ schoolId: leftoverSchool.id });
      await schoolRepo.delete({ id: leftoverSchool.id });
    }
    for (const phone of [
      '+2250100000770',
      '+2250100000771',
      '+2250100000772',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        if (u.role === UserRole.PARENT)
          await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return own profile for PARENT', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(parent.id);
      expect(res.body.data.user.firstName).toBe('Aminata');
      expect(res.body.data.user.lastName).toBe('Koné');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/parents/me');
      expect(res.status).toBe(401);
    });

    it('should return 403 for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents/me')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents/me')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
