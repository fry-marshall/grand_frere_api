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

describe('GET /api/v1/students/me', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let student: Student;
  let studentToken: string;
  let superAdminToken: string;
  let schoolAdminToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const phone of [
      '+2250100000773',
      '+2250100000774',
      '+2250100000775',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        if (u.role === UserRole.STUDENT)
          await studentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }

    const leftoverSchool = await schoolRepo.findOne({
      where: { sigle: 'TS-SGM' },
    });
    if (leftoverSchool) {
      await studentRepo.delete({ schoolId: leftoverSchool.id });
      await userRepo.delete({ schoolId: leftoverSchool.id });
      await schoolRepo.delete({ id: leftoverSchool.id });
    }

    school = await schoolRepo.save({
      name: 'School Student GetMe',
      sigle: 'TS-SGM',
      address: '1 Student GetMe Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSGM',
      phone: '+2250100000773',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminSGM',
      phone: '+2250100000774',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Ibrahim',
      lastName: 'Touré',
      phone: '+2250100000775',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: 'CM1',
    });
  });

  afterAll(async () => {
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100000773',
      '+2250100000774',
      '+2250100000775',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) await userRepo.delete({ id: u.id });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return own profile for STUDENT', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(student.id);
      expect(res.body.data.user.firstName).toBe('Ibrahim');
      expect(res.body.data.user.lastName).toBe('Touré');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/students/me');
      expect(res.status).toBe(401);
    });

    it('should return 403 for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/me')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
