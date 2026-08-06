import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole, UserStatus } from '../../src/modules/users/user.types';

describe('PUT /api/v1/students/:id/block and /unblock', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let student: Student;
  let studentUser: User;

  let superAdminToken: string;
  let ownStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SBU' } });
    if (leftover) {
      await studentRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'School Block Student',
      sigle: 'TS-SBU',
      address: '1 Block Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSBU',
      phone: '+2250100000720',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    studentUser = await userRepo.save({
      firstName: 'Nafissatou',
      lastName: 'Yeo',
      phone: '+2250100000721',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '2nde A',
    });
  });

  afterAll(async () => {
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of ['+2250100000720', '+2250100000721']) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should block a validated student', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${student.id}/block`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.BLOCKED);

      const updated = await userRepo.findOne({ where: { id: studentUser.id } });
      expect(updated?.status).toBe(UserStatus.BLOCKED);
    });

    it('should prevent the blocked student from authenticating', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${ownStudentToken}`);

      expect(res.status).toBe(401);
    });

    it('should unblock a blocked student', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${student.id}/unblock`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(UserStatus.VALIDATED);

      const updated = await userRepo.findOne({ where: { id: studentUser.id } });
      expect(updated?.status).toBe(UserStatus.VALIDATED);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).put(
        `/api/v1/students/${student.id}/block`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when STUDENT role', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${student.id}/block`)
        .set('Authorization', `Bearer ${ownStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 409 when unblocking an already validated student', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${student.id}/unblock`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(409);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/students/00000000-0000-0000-0000-000000000000/block')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
