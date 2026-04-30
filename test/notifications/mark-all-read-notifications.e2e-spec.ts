import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { UserRole } from '../../src/modules/users/user.types';
import { NotificationType } from '../../src/modules/notifications/notification.types';

describe('PUT /api/v1/notifications/read-all', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;

  let parentUser: User;
  let superAdminUser: User;

  let parentToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    notificationRepo = ds.getRepository(Notification);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of ['+2250100006200', '+2250100006201']) {
      await userRepo.delete({ phone });
    }

    parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'NAR',
      phone: '+2250100006200',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    superAdminUser = await userRepo.save({
      firstName: 'SuperAdmin',
      lastName: 'NAR',
      phone: '+2250100006201',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdminUser.id,
      role: superAdminUser.role,
    });

    await notificationRepo.save([
      {
        userId: parentUser.id,
        title: 'Commande validée',
        body: 'Corps 1',
        type: NotificationType.ORDER_VALIDATED,
        isRead: false,
      },
      {
        userId: parentUser.id,
        title: 'Commande annulée',
        body: 'Corps 2',
        type: NotificationType.ORDER_CANCELLED,
        isRead: false,
      },
    ]);
  });

  afterAll(async () => {
    await notificationRepo.delete({ userId: parentUser.id });
    for (const phone of ['+2250100006200', '+2250100006201']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should mark all own notifications as read', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);

      const remaining = await notificationRepo.find({
        where: { userId: parentUser.id, isRead: false },
      });
      expect(remaining.length).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).put(
        '/api/v1/notifications/read-all',
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SUPER_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
