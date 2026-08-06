import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/students', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SL', 'TS-SL2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Students List',
      sigle: 'TS-SL',
      address: '1 Student Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School SL',
      sigle: 'TS-SL2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSL',
      phone: '+2250100000630',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSL',
      phone: '+2250100000631',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownSchoolAdminToken = jwtService.sign({
      sub: ownAdmin.id,
      role: ownAdmin.role,
    });

    const otherAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminSL',
      phone: '+2250100000632',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser1 = await userRepo.save({
      firstName: 'Koné',
      lastName: 'Awa',
      phone: '+2250100000633',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: studentUser1.id,
      schoolId: school.id,
      class: '6ème A',
    });

    const studentUser2 = await userRepo.save({
      firstName: 'Bamba',
      lastName: 'Issouf',
      phone: '+2250100000634',
      role: UserRole.STUDENT,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: studentUser2.id,
      schoolId: otherSchool.id,
      class: '5ème B',
    });
  });

  afterAll(async () => {
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000630',
      '+2250100000631',
      '+2250100000632',
      '+2250100000633',
      '+2250100000634',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all students for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should include user, school, card and balance fields in response', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const student = res.body.data.data[0] as {
        user: { firstName: string };
        schoolName: string;
        status: string;
        balance: number;
        cardCode: string | null;
        cardStatus: string | null;
        class: string;
      };
      expect(student.user).toBeDefined();
      expect(student.user.firstName).toBeDefined();
      expect(student.schoolName).toBeDefined();
      expect(student.status).toBeDefined();
      expect(student.balance).toBe(0);
      expect(student.cardCode).toBeNull();
      expect(student.cardStatus).toBeNull();
      expect(student.class).toBeDefined();
    });

    it('should filter by school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students?schoolId=${school.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.data.every(
          (s: { schoolId: string }) => s.schoolId === school.id,
        ),
      ).toBe(true);
    });

    it('should filter by class', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students?class=6ème A')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.data.every(
          (s: { class: string }) => s.class === '6ème A',
        ),
      ).toBe(true);
    });

    it('should search by name', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students?search=Awa')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(1);
      expect(
        res.body.data.data.every(
          (s: { user: { lastName: string } }) => s.user.lastName === 'Awa',
        ),
      ).toBe(true);
    });

    it('should support pagination', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students?page=1&limit=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/students');
      expect(res.status).toBe(401);
    });

    it('should return 403 when STUDENT role', async () => {
      const studentUser = await userRepo.findOne({
        where: { phone: '+2250100000633' },
      });
      const token = jwtService.sign({
        sub: studentUser!.id,
        role: UserRole.STUDENT,
      });
      const res = await request(getServer(app))
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN role', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN role (another school)', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
