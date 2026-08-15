import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { RefreshToken } from '../../src/modules/refresh-tokens/entities/refresh-token.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET/PUT/DELETE /api/v1/auth/me', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let refreshTokenRepo: Repository<RefreshToken>;
  let jwtService: JwtService;

  let superAdmin: User;
  let superAdminToken: string;
  let schoolAdmin: User;
  let schoolAdminToken: string;
  let otherUser: User;

  const PHONES = ['+2250100000790', '+2250100000791', '+2250100000792'];
  const DELETE_PHONE = '+2250100000794';

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    refreshTokenRepo = ds.getRepository(RefreshToken);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [...PHONES, DELETE_PHONE]) {
      const leftover = await userRepo.findOne({
        where: { phone },
        withDeleted: true,
      });
      if (leftover) {
        await refreshTokenRepo.delete({ userId: leftover.id });
        await userRepo.delete({ id: leftover.id });
      }
    }

    const school = await schoolRepo.save({
      name: 'School Me',
      sigle: 'TS-ME',
      address: '1 Me Street',
      status: SchoolStatus.ACTIVE,
    });

    superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminMe',
      phone: PHONES[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminMe',
      phone: PHONES[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    otherUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'UserMe',
      phone: PHONES[2],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
  });

  afterAll(async () => {
    const leftoverSchool = await schoolRepo.findOne({
      where: { sigle: 'TS-ME' },
    });
    if (leftoverSchool) {
      await userRepo.delete({ schoolId: leftoverSchool.id });
      await schoolRepo.delete({ id: leftoverSchool.id });
    }
    for (const phone of [...PHONES, '+2250100000793', DELETE_PHONE]) {
      const leftover = await userRepo.findOne({
        where: { phone },
        withDeleted: true,
      });
      if (leftover) await refreshTokenRepo.delete({ userId: leftover.id });
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return the SUPER_ADMIN profile without a school', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(superAdmin.id);
      expect(res.body.data.firstName).toBe('Super');
      expect(res.body.data.lastName).toBe('AdminMe');
      expect(res.body.data.phone).toBe(PHONES[0]);
      expect(res.body.data.role).toBe(UserRole.SUPER_ADMIN);
      expect(res.body.data.schoolId).toBeNull();
      expect(res.body.data.schoolName).toBeNull();
    });

    it('should return the SCHOOL_ADMIN profile with its school name', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.schoolName).toBe('School Me');
    });

    it("should update the current user's profile", async () => {
      const res = await request(getServer(app))
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          firstName: 'Superb',
          lastName: 'AdminUpdated',
          phone: '+2250100000793',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Superb');
      expect(res.body.data.lastName).toBe('AdminUpdated');
      expect(res.body.data.phone).toBe('+2250100000793');

      const updated = await userRepo.findOne({ where: { id: superAdmin.id } });
      expect(updated!.phone).toBe('+2250100000793');

      // restore for other tests / afterAll cleanup
      await userRepo.update(superAdmin.id, {
        firstName: 'Super',
        lastName: 'AdminMe',
        phone: PHONES[0],
      });
    });
  });

  describe('Failure cases', () => {
    it('should return 401 for GET when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 for PUT when no token', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/auth/me')
        .send({ firstName: 'A', lastName: 'B', phone: PHONES[0] });
      expect(res.status).toBe(401);
    });

    it('should return 400 when phone is not a valid CI number', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ firstName: 'A', lastName: 'B', phone: '0700000000' });
      expect(res.status).toBe(400);
    });

    it('should return 409 when phone already belongs to another user', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          firstName: 'Super',
          lastName: 'AdminMe',
          phone: otherUser.phone,
        });
      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /api/v1/auth/me', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).delete('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('should soft delete the account, revoke its refresh tokens, and close off the login', async () => {
      const user = await userRepo.save({
        firstName: 'ToDelete',
        lastName: 'Me',
        phone: DELETE_PHONE,
        role: UserRole.SUPER_ADMIN,
        isOnboarded: true,
      });
      const token = jwtService.sign({ sub: user.id, role: user.role });
      const refreshToken = await refreshTokenRepo.save({
        userId: user.id,
        tokenHash: 'test-hash-for-delete-me',
        expiresAt: new Date(Date.now() + 86400000),
      });

      const res = await request(getServer(app))
        .delete('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const deleted = await userRepo.findOne({
        where: { id: user.id },
        withDeleted: true,
      });
      expect(deleted?.deletedAt).not.toBeNull();

      const stillFindable = await userRepo.findOne({
        where: { id: user.id },
      });
      expect(stillFindable).toBeNull();

      const revokedToken = await refreshTokenRepo.findOne({
        where: { id: refreshToken.id },
      });
      expect(revokedToken?.isRevoked).toBe(true);

      // The login is closed off: the JWT strategy itself can't find the
      // user anymore (soft-deleted), so an otherwise still-valid token is
      // rejected outright.
      const getRes = await request(getServer(app))
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(401);
    });
  });
});
