import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { UserRole, UserStatus } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('Blocked user access to protected routes', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let blockedUser: User;
  let blockedToken: string;

  const phone = '+2250100000871';

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await userRepo.delete({ phone });

    blockedUser = await userRepo.save({
      firstName: 'Blocked',
      lastName: 'Student',
      phone,
      role: UserRole.STUDENT,
      status: UserStatus.BLOCKED,
      isOnboarded: true,
    });

    blockedToken = jwtService.sign({
      sub: blockedUser.id,
      role: blockedUser.role,
    });
  });

  afterAll(async () => {
    await userRepo.delete({ phone });
    await app.close();
  });

  describe('Failure cases', () => {
    it('should return 401 when a blocked user calls a protected endpoint with a valid token', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${blockedToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.AUTH.ACCOUNT_BLOCKED);
    });
  });
});
