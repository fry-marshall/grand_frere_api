import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { UserRole } from '../../src/modules/users/user.types';
import { NotificationType } from '../../src/modules/notifications/notification.types';

describe('PUT /api/v1/notifications/:id/read', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;

  let parentUser: User;
  let otherUser: User;
  let superAdminUser: User;

  let parentToken: string;
  let otherToken: string;
  let superAdminToken: string;

  let unreadNotification: Notification;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    notificationRepo = ds.getRepository(Notification);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [
      '+2250100006100',
      '+2250100006101',
      '+2250100006102',
    ]) {
      await userRepo.delete({ phone });
    }

    parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'NR',
      phone: '+2250100006100',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    otherUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'NR',
      phone: '+2250100006101',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    otherToken = jwtService.sign({ sub: otherUser.id, role: otherUser.role });

    superAdminUser = await userRepo.save({
      firstName: 'SuperAdmin',
      lastName: 'NR',
      phone: '+2250100006102',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdminUser.id,
      role: superAdminUser.role,
    });

    unreadNotification = await notificationRepo.save({
      userId: parentUser.id,
      title: 'Commande validée',
      body: 'Votre commande a été validée',
      type: NotificationType.ORDER_VALIDATED,
      isRead: false,
    });
  });

  afterAll(async () => {
    await notificationRepo.delete({ userId: parentUser.id });
    await notificationRepo.delete({ userId: otherUser.id });
    for (const phone of [
      '+2250100006100',
      '+2250100006101',
      '+2250100006102',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should mark a notification as read', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(unreadNotification.id);
      expect(res.body.data.isRead).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).put(
        `/api/v1/notifications/${unreadNotification.id}/read`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SUPER_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when notification belongs to another user', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/notifications/${unreadNotification.id}/read`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when notification does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(404);
    });
  });
});
