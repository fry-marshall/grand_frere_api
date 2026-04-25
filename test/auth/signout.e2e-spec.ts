import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { RefreshToken } from '../../src/modules/refresh-tokens/entities/refresh-token.entity';
import { UserRole } from '../../src/modules/users/user.types';

const PHONE = '+2250100000070';

describe('POST /api/v1/auth/signout', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;

  let user: User;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    refreshTokenRepo = ds.getRepository(RefreshToken);

    await userRepo.delete({ phone: PHONE });

    user = await userRepo.save({
      firstName: 'Kouassi',
      lastName: 'Yao',
      phone: PHONE,
      passwordHash: await bcrypt.hash('SecurePass123', 10),
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
  });

  afterAll(async () => {
    await userRepo.delete({ phone: PHONE });
    await app.close();
  });

  const seedToken = async (isRevoked = false): Promise<string> => {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      isRevoked,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return raw;
  };

  describe('Success cases', () => {
    it('should revoke a valid refresh token and return 200', async () => {
      const token = await seedToken();

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .send({ refreshToken: token });

      expect(res.status).toBe(200);

      const hash = createHash('sha256').update(token).digest('hex');
      const stored = await refreshTokenRepo.findOne({
        where: { tokenHash: hash },
      });
      expect(stored?.isRevoked).toBe(true);
      expect(stored?.revokedAt).toBeDefined();
    });

    it('should return 200 when token is already revoked (idempotent)', async () => {
      const token = await seedToken(true);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .send({ refreshToken: token });

      expect(res.status).toBe(200);
    });

    it('should return 200 when token does not exist (idempotent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .send({ refreshToken: 'totally-fake-token' });

      expect(res.status).toBe(200);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when refreshToken field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signout')
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
