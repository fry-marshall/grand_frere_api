import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { UserRole } from '../../src/modules/users/user.types';

describe('PUT /api/v1/auth/change-password', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let parentUser: User;
  let parentToken: string;
  let studentUser: User;
  let studentToken: string;

  const CURRENT_PASSWORD = 'OldPass123!';

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of ['+2250100000720', '+2250100000721']) {
      await userRepo.delete({ phone });
    }

    const passwordHash = await bcrypt.hash(CURRENT_PASSWORD, 10);

    parentUser = await userRepo.save({
      firstName: 'Change',
      lastName: 'PwParent',
      phone: '+2250100000720',
      passwordHash,
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    studentUser = await userRepo.save({
      firstName: 'Change',
      lastName: 'PwStudent',
      phone: '+2250100000721',
      passwordHash,
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
  });

  afterAll(async () => {
    for (const phone of ['+2250100000720', '+2250100000721']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should change password for a PARENT', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: 'NewPass456!',
        });

      expect(res.status).toBe(200);

      const updated = await userRepo.findOne({ where: { id: parentUser.id } });
      const match = await bcrypt.compare('NewPass456!', updated!.passwordHash);
      expect(match).toBe(true);

      await userRepo.update(parentUser.id, {
        passwordHash: await bcrypt.hash(CURRENT_PASSWORD, 10),
      });
    });

    it('should change password for a STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: 'NewPass789!',
        });

      expect(res.status).toBe(200);

      const updated = await userRepo.findOne({ where: { id: studentUser.id } });
      const match = await bcrypt.compare('NewPass789!', updated!.passwordHash);
      expect(match).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .send({
          currentPassword: CURRENT_PASSWORD,
          newPassword: 'NewPass456!',
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 when currentPassword is wrong', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ currentPassword: 'WrongPass!', newPassword: 'NewPass456!' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when newPassword is too short', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ currentPassword: CURRENT_PASSWORD, newPassword: 'short' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when body is missing fields', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ currentPassword: CURRENT_PASSWORD });

      expect(res.status).toBe(400);
    });
  });
});
