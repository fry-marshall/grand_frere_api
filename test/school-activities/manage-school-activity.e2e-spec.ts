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
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('PUT/DELETE /api/v1/school-activities/:id', () => {
  let app: INestApplication;
  let activityRepo: Repository<SchoolActivity>;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let superAdminToken: string;

  let activity: SchoolActivity;

  const phones = ['+2250100009310', '+2250100009311', '+2250100009312'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    activityRepo = ds.getRepository(SchoolActivity);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SAC2', 'TS-SAC3']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await activityRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of phones) await userRepo.delete({ phone });

    school = await schoolRepo.save({
      name: 'School Activities Manage',
      sigle: 'TS-SAC2',
      address: '2 Rue Manage',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School Activities',
      sigle: 'TS-SAC3',
      address: '3 Rue Other',
      status: SchoolStatus.ACTIVE,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminManage',
      phone: phones[0],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const otherAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminManage',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminManage',
      phone: phones[2],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });
  });

  afterAll(async () => {
    await activityRepo.delete({ schoolId: school.id });
    await activityRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of phones) await userRepo.delete({ phone });
    await app.close();
  });

  beforeEach(async () => {
    activity = await activityRepo.save({
      schoolId: school.id,
      title: 'Original title',
      description: 'Original description',
      isVisible: false,
    });
  });

  describe('PUT /school-activities/:id', () => {
    describe('Success cases', () => {
      it('should let the owning SCHOOL_ADMIN update title and description', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}`)
          .set('Authorization', `Bearer ${schoolAdminToken}`)
          .field('title', 'Updated title');

        expect(res.status).toBe(200);
        expect(res.body.data.title).toBe('Updated title');
        expect(res.body.data.description).toBe('Original description');
      });

      it('should replace the existing photo set when new photos are sent', async () => {
        await activityRepo.update(activity.id, {
          photoUrls: ['old-photo.jpg'],
        });

        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}`)
          .set('Authorization', `Bearer ${schoolAdminToken}`)
          .attach('photos[]', Buffer.from('new-photo-content'), {
            filename: 'new-photo.jpg',
            contentType: 'image/jpeg',
          });

        expect(res.status).toBe(200);
        expect(res.body.data.photoUrls).toHaveLength(1);
        expect(res.body.data.photoUrls[0]).not.toContain('old-photo.jpg');

        const dbActivity = await activityRepo.findOne({
          where: { id: activity.id },
        });
        expect(dbActivity?.photoUrls).toHaveLength(1);
        expect(dbActivity?.photoUrls[0]).not.toBe('old-photo.jpg');
        expect(dbActivity?.photoUrls[0]).not.toContain('/');
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when another school admin tries to update it', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
          .field('title', 'Hacked title');
        expect(res.status).toBe(403);
      });

      it('should return 404 when activity does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/school-activities/00000000-0000-0000-0000-000000000000')
          .set('Authorization', `Bearer ${superAdminToken}`)
          .field('title', 'Ghost');
        expect(res.status).toBe(404);
      });
    });
  });

  describe('DELETE /school-activities/:id', () => {
    describe('Success cases', () => {
      it('should let the owning SCHOOL_ADMIN delete the activity', async () => {
        const res = await request(getServer(app))
          .delete(`/api/v1/school-activities/${activity.id}`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(204);

        const deleted = await activityRepo.findOne({
          where: { id: activity.id },
        });
        expect(deleted).toBeNull();
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when another school admin tries to delete it', async () => {
        const res = await request(getServer(app))
          .delete(`/api/v1/school-activities/${activity.id}`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('PUT /school-activities/:id/publish', () => {
    describe('Success cases', () => {
      it('should make the activity visible', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}/publish`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.isVisible).toBe(true);
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when already visible', async () => {
        await activityRepo.update(activity.id, { isVisible: true });

        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}/publish`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOL_ACTIVITIES.NOT_PUBLISHABLE,
        );
      });

      it('should return 403 when another school admin tries to publish it', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}/publish`)
          .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe('PUT /school-activities/:id/hide', () => {
    describe('Success cases', () => {
      it('should make a visible activity hidden', async () => {
        await activityRepo.update(activity.id, { isVisible: true });

        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}/hide`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.isVisible).toBe(false);
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when already hidden', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-activities/${activity.id}/hide`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOL_ACTIVITIES.NOT_HIDABLE,
        );
      });
    });
  });
});
