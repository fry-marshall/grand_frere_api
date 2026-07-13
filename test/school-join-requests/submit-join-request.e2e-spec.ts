import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { SchoolJoinRequest } from '../../src/modules/school-join-requests/entities/school-join-request.entity';
import { SchoolJoinRequestStatus } from '../../src/modules/school-join-requests/school-join-request.types';
import { Gender } from '../../src/modules/users/user.types';

describe('POST /api/v1/school-join-requests', () => {
  let app: INestApplication;
  let requestRepo: Repository<SchoolJoinRequest>;

  const validPayload = {
    schoolName: 'Ecole Test Submit',
    city: 'Abidjan',
    studentCount: 300,
    gender: Gender.FEMALE,
    firstName: 'Awa',
    lastName: 'Koffi',
    phone: '+2250100009200',
    email: 'awa.koffi@example.com',
    position: 'Directrice',
    message: 'We would like to join the network.',
  };

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    requestRepo = ds.getRepository(SchoolJoinRequest);

    await requestRepo.delete({ phone: validPayload.phone });
  });

  afterAll(async () => {
    await requestRepo.delete({ phone: validPayload.phone });
    await app.close();
  });

  describe('Success cases', () => {
    it('should create a pending join request without authentication', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(SchoolJoinRequestStatus.PENDING);
      expect(res.body.data.city).toBe(validPayload.city);
      expect(res.body.data.phone).toBe(validPayload.phone);
      expect(res.body.data.email).toBe(validPayload.email);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ schoolName: 'Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when phone is not a valid CI number', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, phone: '123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when email is not valid', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when gender is not a valid enum value', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, gender: 'OTHER' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when studentCount is not a positive integer', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, studentCount: 0 });

      expect(res.status).toBe(400);
    });
  });
});
