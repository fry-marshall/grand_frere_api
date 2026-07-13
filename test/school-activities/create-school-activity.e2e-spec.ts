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

describe('POST /api/v1/school-activities', () => {
  let app: INestApplication;
  let activityRepo: Repository<SchoolActivity>;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let superAdminToken: string;
  let schoolAdminToken: string;

  const phones = ['+2250100009300', '+2250100009301'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    activityRepo = ds.getRepository(SchoolActivity);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SAC' } });
    if (leftover) {
      await activityRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    for (const phone of phones) await userRepo.delete({ phone });

    school = await schoolRepo.save({
      name: 'School Activities Create',
      sigle: 'TS-SAC',
      address: '1 Rue Create',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSAC',
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
      lastName: 'AdminSAC',
      phone: phones[1],
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
    await activityRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of phones) await userRepo.delete({ phone });
    await app.close();
  });

  describe('Success cases', () => {
    it('should let SCHOOL_ADMIN create a draft activity for their own school', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .field('title', 'Journée sportive')
        .field('description', 'Activités sportives pour les élèves.');

      expect(res.status).toBe(201);
      expect(res.body.data.isVisible).toBe(false);
      expect(res.body.data.schoolId).toBe(school.id);
      expect(res.body.data.photoUrls).toEqual([]);
    });

    it('should let SUPER_ADMIN create an activity for a given schoolId', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .field('title', 'Kermesse')
        .field('description', 'Fête annuelle de l’école.')
        .field('schoolId', school.id);

      expect(res.status).toBe(201);
      expect(res.body.data.schoolId).toBe(school.id);
      expect(res.body.data.isVisible).toBe(false);
    });

    it('should upload photos and return their URLs', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .field('title', 'Sortie scolaire')
        .field('description', 'Visite du musée.')
        .attach('photos[]', Buffer.from('fake-image-content'), {
          filename: 'photo.jpg',
          contentType: 'image/jpeg',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.photoUrls).toHaveLength(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when title is missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .field('description', 'Missing title');
      expect(res.status).toBe(400);
    });

    it('should return 400 when SUPER_ADMIN omits schoolId', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .field('title', 'No school')
        .field('description', 'Missing schoolId');
      expect(res.status).toBe(400);
    });

    it('should return 401 without authentication', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-activities')
        .field('title', 'No auth')
        .field('description', 'No auth');
      expect(res.status).toBe(401);
    });
  });
});
