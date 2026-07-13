import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { SchoolActivity } from '../../src/modules/school-activities/entities/school-activity.entity';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/school-activities', () => {
  let app: INestApplication;
  let activityRepo: Repository<SchoolActivity>;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let schoolAdminToken: string;

  let publishedActivity: SchoolActivity;
  let draftActivity: SchoolActivity;

  const phone = '+2250100009320';

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    activityRepo = ds.getRepository(SchoolActivity);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SAC4' } });
    if (leftover) {
      await activityRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    await userRepo.delete({ phone });

    school = await schoolRepo.save({
      name: 'School Activities List',
      sigle: 'TS-SAC4',
      address: '4 Rue List',
      status: SchoolStatus.ACTIVE,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminList',
      phone,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    publishedActivity = await activityRepo.save({
      schoolId: school.id,
      title: 'Published activity',
      description: 'Visible to everyone',
      isVisible: true,
    });

    draftActivity = await activityRepo.save({
      schoolId: school.id,
      title: 'Draft activity',
      description: 'Not visible yet',
      isVisible: false,
    });
  });

  afterAll(async () => {
    await activityRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await userRepo.delete({ phone });
    await app.close();
  });

  describe('GET /school-activities (public)', () => {
    describe('Success cases', () => {
      it('should return only visible activities without authentication', async () => {
        const res = await request(getServer(app)).get(
          `/api/v1/school-activities?schoolId=${school.id}`,
        );

        expect(res.status).toBe(200);
        const ids = res.body.data.data.map((a: { id: string }) => a.id);
        expect(ids).toContain(publishedActivity.id);
        expect(ids).not.toContain(draftActivity.id);
      });

      it('should include nested school info', async () => {
        const res = await request(getServer(app)).get(
          `/api/v1/school-activities?schoolId=${school.id}`,
        );
        const found = res.body.data.data.find(
          (a: { id: string }) => a.id === publishedActivity.id,
        );
        expect(found.school.sigle).toBe('TS-SAC4');
      });
    });
  });

  describe('GET /school-activities/:id (public)', () => {
    describe('Success cases', () => {
      it('should return a published activity', async () => {
        const res = await request(getServer(app)).get(
          `/api/v1/school-activities/${publishedActivity.id}`,
        );
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(publishedActivity.id);
      });
    });

    describe('Failure cases', () => {
      it('should return 404 for a draft activity', async () => {
        const res = await request(getServer(app)).get(
          `/api/v1/school-activities/${draftActivity.id}`,
        );
        expect(res.status).toBe(404);
      });

      it('should return 404 when activity does not exist', async () => {
        const res = await request(getServer(app)).get(
          '/api/v1/school-activities/00000000-0000-0000-0000-000000000000',
        );
        expect(res.status).toBe(404);
      });
    });
  });

  describe('GET /school-activities/mine', () => {
    describe('Success cases', () => {
      it('should return both draft and published activities for the owning SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/school-activities/mine')
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        const ids = res.body.data.data.map((a: { id: string }) => a.id);
        expect(ids).toContain(publishedActivity.id);
        expect(ids).toContain(draftActivity.id);
      });
    });

    describe('Failure cases', () => {
      it('should return 401 without authentication', async () => {
        const res = await request(getServer(app)).get(
          '/api/v1/school-activities/mine',
        );
        expect(res.status).toBe(401);
      });
    });
  });
});
