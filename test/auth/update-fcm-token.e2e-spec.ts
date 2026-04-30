import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { UserRole } from '../../src/modules/users/user.types';

describe('PUT /api/v1/auth/fcm-token', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let user: User;
  let userToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await userRepo.delete({ phone: '+2250100007000' });

    user = await userRepo.save({
      firstName: 'Test',
      lastName: 'FCM',
      phone: '+2250100007000',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    userToken = jwtService.sign({ sub: user.id, role: user.role });
  });

  afterAll(async () => {
    await userRepo.delete({ phone: '+2250100007000' });
    await app.close();
  });

  describe('Success cases', () => {
    it('should register a FCM token', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ fcmToken: 'fcm-device-token-abc123' });

      expect(res.status).toBe(200);

      const updated = await userRepo.findOne({ where: { id: user.id } });
      expect(updated!.fcmToken).toBe('fcm-device-token-abc123');
    });

    it('should clear the FCM token when null is sent', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/fcm-token')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ fcmToken: null });

      expect(res.status).toBe(200);

      const updated = await userRepo.findOne({ where: { id: user.id } });
      expect(updated!.fcmToken).toBeNull();
    });

    it('should work with any authenticated role (VENDOR)', async () => {
      const vendorUser = await userRepo.save({
        firstName: 'Vendor',
        lastName: 'FCM',
        role: UserRole.VENDOR,
        isOnboarded: true,
      });
      const vendorToken = jwtService.sign({
        sub: vendorUser.id,
        role: vendorUser.role,
      });

      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/fcm-token')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ fcmToken: 'vendor-fcm-token' });

      expect(res.status).toBe(200);

      const updated = await userRepo.findOne({ where: { id: vendorUser.id } });
      expect(updated!.fcmToken).toBe('vendor-fcm-token');

      await userRepo.delete({ id: vendorUser.id });
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/auth/fcm-token')
        .send({ fcmToken: 'some-token' });
      expect(res.status).toBe(401);
    });
  });
});
