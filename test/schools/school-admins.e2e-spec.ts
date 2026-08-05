import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/schools/:id/admins', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let admin: User;
  let superAdminToken: string;
  let schoolAdminToken: string;
  let vendorToken: string;

  const phones = [
    '+2250100007300',
    '+2250100007301',
    '+2250100007302',
    '+2250100007303',
  ];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await schoolRepo.delete({ sigle: 'ADM-T1' });
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Admins Test',
      sigle: 'ADM-T1',
      address: '1 Admins St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminList',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    admin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminList',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({ sub: admin.id, role: admin.role });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'AdminList',
      phone: phones[2],
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
  });

  afterAll(async () => {
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should list admins of the school for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/admins`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].id).toBe(admin.id);
      expect(res.body.data.data[0]).not.toHaveProperty('password');
      expect(res.body.data.data[0]).not.toHaveProperty('passwordHash');
      expect(res.body.data.meta.total).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 without a token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/schools/${school.id}/admins`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/admins`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/admins`)
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/00000000-0000-0000-0000-000000000000/admins')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
