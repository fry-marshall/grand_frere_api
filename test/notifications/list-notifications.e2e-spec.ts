import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Notification } from '../../src/modules/notifications/entities/notification.entity';
import { UserRole } from '../../src/modules/users/user.types';
import { NotificationType } from '../../src/modules/notifications/notification.types';

describe('GET /api/v1/notifications', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let notificationRepo: Repository<Notification>;
  let jwtService: JwtService;

  let parentUser: User;
  let vendorUser: User;
  let superAdminUser: User;
  let schoolAdminUser: User;

  let parentToken: string;
  let vendorToken: string;
  let superAdminToken: string;
  let schoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    notificationRepo = ds.getRepository(Notification);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [
      '+2250100006000',
      '+2250100006001',
      '+2250100006002',
      '+2250100006003',
    ]) {
      await userRepo.delete({ phone });
    }

    parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'NF',
      phone: '+2250100006000',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'NF',
      phone: '+2250100006001',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    superAdminUser = await userRepo.save({
      firstName: 'SuperAdmin',
      lastName: 'NF',
      phone: '+2250100006002',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdminUser.id,
      role: superAdminUser.role,
    });

    schoolAdminUser = await userRepo.save({
      firstName: 'SchoolAdmin',
      lastName: 'NF',
      phone: '+2250100006003',
      role: UserRole.SCHOOL_ADMIN,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdminUser.id,
      role: schoolAdminUser.role,
    });

    await notificationRepo.save([
      {
        userId: parentUser.id,
        title: 'Commande validée',
        body: 'Votre commande a été validée',
        type: NotificationType.ORDER_VALIDATED,
        isRead: false,
      },
      {
        userId: parentUser.id,
        title: 'Recharge réussie',
        body: 'Votre wallet a été crédité',
        type: NotificationType.TOPUP_SUCCESS,
        isRead: true,
      },
      {
        userId: vendorUser.id,
        title: 'Reversement réussi',
        body: 'Votre reversement a été effectué',
        type: NotificationType.WITHDRAWAL_SUCCESS,
        isRead: false,
      },
    ]);
  });

  afterAll(async () => {
    await notificationRepo.delete({ userId: parentUser.id });
    await notificationRepo.delete({ userId: vendorUser.id });
    for (const phone of [
      '+2250100006000',
      '+2250100006001',
      '+2250100006002',
      '+2250100006003',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return own notifications as PARENT', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(2);
      const userIds = res.body.data.data.map(
        (n: { userId: string }) => n.userId,
      );
      expect(userIds.every((id: string) => id === parentUser.id)).toBe(true);
      expect(res.body.data.meta).toBeDefined();
    });

    it('should return own notifications as VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].userId).toBe(vendorUser.id);
    });

    it('should respect pagination (limit=1)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?page=1&limit=1')
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.totalPages).toBe(2);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/notifications',
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SUPER_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN calls this endpoint', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
