import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

const PHONE = '+2250100000050';
const PASSWORD = 'SecurePass123';

describe('POST /api/v1/auth/signin', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);

    await userRepo.delete({ phone: PHONE });

    await userRepo.save({
      firstName: 'Kouassi',
      lastName: 'Yao',
      phone: PHONE,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
  });

  afterAll(async () => {
    await userRepo.delete({ phone: PHONE });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return tokens for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ phone: PHONE, password: PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ phone: PHONE });

      expect(res.status).toBe(400);
    });

    it('should return 400 when phone format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ phone: '+33612345678', password: PASSWORD });

      expect(res.status).toBe(400);
    });

    it('should return 401 when phone does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ phone: '+2250100000099', password: PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    });

    it('should return 401 when password is wrong', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signin')
        .send({ phone: PHONE, password: 'WrongPass123' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.INVALID_CREDENTIALS);
    });
  });
});
