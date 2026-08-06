import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { UserRole, UserStatus } from '../../src/modules/users/user.types';

describe('PUT /api/v1/parents/:id/block and /unblock', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let parentRepo: Repository<Parent>;
  let jwtService: JwtService;

  let parent: Parent;
  let parentUser: User;

  let superAdminToken: string;
  let ownParentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    parentRepo = ds.getRepository(Parent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminPBU',
      phone: '+2250100000730',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    parentUser = await userRepo.save({
      firstName: 'Mariam',
      lastName: 'Coulibaly',
      phone: '+2250100000731',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    ownParentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    parent = await parentRepo.save({ userId: parentUser.id });
  });

  afterAll(async () => {
    await parentRepo.delete({ id: parent.id });
    for (const phone of ['+2250100000730', '+2250100000731']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should block a validated parent', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/parents/${parent.id}/block`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.BLOCKED);

      const updated = await userRepo.findOne({ where: { id: parentUser.id } });
      expect(updated?.status).toBe(UserStatus.BLOCKED);
    });

    it('should prevent the blocked parent from authenticating', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}`)
        .set('Authorization', `Bearer ${ownParentToken}`);

      expect(res.status).toBe(401);
    });

    it('should unblock a blocked parent', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/parents/${parent.id}/unblock`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.VALIDATED);

      const updated = await userRepo.findOne({ where: { id: parentUser.id } });
      expect(updated?.status).toBe(UserStatus.VALIDATED);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).put(
        `/api/v1/parents/${parent.id}/block`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT role', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/parents/${parent.id}/block`)
        .set('Authorization', `Bearer ${ownParentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 409 when unblocking an already validated parent', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/parents/${parent.id}/unblock`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(409);
    });

    it('should return 404 when parent does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/00000000-0000-0000-0000-000000000000/block')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
