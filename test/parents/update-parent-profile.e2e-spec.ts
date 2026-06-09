import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { UserRole } from '../../src/modules/users/user.types';

describe('PUT /api/v1/parents/me', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let parentRepo: Repository<Parent>;
  let jwtService: JwtService;

  let parentUser: User;
  let parentToken: string;
  let otherParentUser: User;
  let studentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    parentRepo = ds.getRepository(Parent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [
      '+2250100000730',
      '+2250100000731',
      '+2250100000732',
    ]) {
      await userRepo.delete({ phone });
    }

    parentUser = await userRepo.save({
      firstName: 'Original',
      lastName: 'Parent',
      phone: '+2250100000730',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    await parentRepo.save({ userId: parentUser.id });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    otherParentUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'Parent',
      phone: '+2250100000731',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    await parentRepo.save({ userId: otherParentUser.id });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'UPP',
      phone: '+2250100000732',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
  });

  afterAll(async () => {
    for (const phone of [
      '+2250100000730',
      '+2250100000731',
      '+2250100000732',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should update firstName', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.firstName).toBe('Updated');
    });

    it('should update lastName', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ lastName: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.lastName).toBe('Renamed');
    });

    it('should update phone', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ phone: '+2250100000730' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.phone).toBe('+2250100000730');
    });

    it('should accept empty body (no-op)', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when role is STUDENT', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 409 when phone is already taken by another user', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ phone: '+2250100000731' });

      expect(res.status).toBe(409);
    });

    it('should return 400 when firstName is empty string', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ firstName: '' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when phone has invalid format', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/parents/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ phone: '0102030405' });

      expect(res.status).toBe(400);
    });
  });
});
