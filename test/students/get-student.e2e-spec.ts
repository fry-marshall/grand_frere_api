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

describe('GET /api/v1/students/:id', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;
  let studentUser: User;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let ownStudentToken: string;
  let otherStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SGO', 'TS-SGO2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Get Student',
      sigle: 'TS-SGO',
      address: '1 Get Student Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School SGO',
      sigle: 'TS-SGO2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSGO',
      phone: '+2250100000640',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSGO',
      phone: '+2250100000641',
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
      lastName: 'AdminSGO',
      phone: '+2250100000642',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    studentUser = await userRepo.save({
      firstName: 'Fatou',
      lastName: 'Traoré',
      phone: '+2250100000643',
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
      class: '3ème A',
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Soro',
      lastName: 'Ibrahim',
      phone: '+2250100000644',
      role: UserRole.STUDENT,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
    await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: otherSchool.id,
      class: '4ème B',
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
      '+2250100000640',
      '+2250100000641',
      '+2250100000642',
      '+2250100000643',
      '+2250100000644',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return student for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(student.id);
      expect(res.body.data.class).toBe('3ème A');
      expect(res.body.data.schoolId).toBe(school.id);
      expect(res.body.data.user.firstName).toBe('Fatou');
    });

    it('should return student for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(student.id);
    });

    it('should return own profile for STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${ownStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(student.id);
    });

    it('should include card field (null when no card assigned)', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect('card' in res.body.data).toBe(true);
      expect(res.body.data.card).toBeNull();
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/students/${student.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school student', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another student profile', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
