import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { SchoolJoinRequest } from '../../src/modules/school-join-requests/entities/school-join-request.entity';
import { SchoolJoinRequestStatus } from '../../src/modules/school-join-requests/school-join-request.types';

describe('POST /api/v1/school-join-requests', () => {
  let app: INestApplication;
  let requestRepo: Repository<SchoolJoinRequest>;

  const validPayload = {
    schoolName: 'Ecole Test Submit',
    sigle: 'TS-JR',
    address: '1 Rue Submit',
    contactFirstName: 'Awa',
    contactLastName: 'Koffi',
    contactPhone: '+2250100009200',
    message: 'We would like to join the network.',
  };

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    requestRepo = ds.getRepository(SchoolJoinRequest);

    await requestRepo.delete({ sigle: 'TS-JR' });
  });

  afterAll(async () => {
    await requestRepo.delete({ sigle: 'TS-JR' });
    await app.close();
  });

  describe('Success cases', () => {
    it('should create a pending join request without authentication', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send(validPayload);

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(SchoolJoinRequestStatus.PENDING);
      expect(res.body.data.sigle).toBe('TS-JR');
      expect(res.body.data.contactPhone).toBe(validPayload.contactPhone);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ schoolName: 'Incomplete' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when contactPhone is not a valid CI number', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, contactPhone: '123' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when sigle does not match the expected format', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/school-join-requests')
        .send({ ...validPayload, sigle: 'lowercase' });

      expect(res.status).toBe(400);
    });
  });
});
