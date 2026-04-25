import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { RefreshToken } from '../../src/modules/refresh-tokens/entities/refresh-token.entity';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

const PHONE = '+2250100000060';

describe('POST /api/v1/auth/refresh', () => {
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

  const seedToken = async (opts: {
    isRevoked?: boolean;
    expiresAt?: Date;
  }): Promise<string> => {
    const raw = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    await refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      isRevoked: opts.isRevoked ?? false,
      expiresAt:
        opts.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    return raw;
  };

  describe('Success cases', () => {
    it('should return a new token pair and revoke the old refresh token', async () => {
      const oldToken = await seedToken({});

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldToken });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(oldToken);

      const oldHash = createHash('sha256').update(oldToken).digest('hex');
      const stored = await refreshTokenRepo.findOne({
        where: { tokenHash: oldHash },
      });
      expect(stored?.isRevoked).toBe(true);
      expect(stored?.revokedAt).toBeDefined();
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when refreshToken field is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 401 when refresh token does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'totally-fake-token' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    });

    it('should return 401 when refresh token is already revoked', async () => {
      const revokedToken = await seedToken({ isRevoked: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: revokedToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    });

    it('should return 401 when refresh token is expired', async () => {
      const expiredToken = await seedToken({
        expiresAt: new Date(Date.now() - 1000),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: expiredToken });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.INVALID_REFRESH_TOKEN);
    });
  });
});
