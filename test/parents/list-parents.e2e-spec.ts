import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/parents', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let studentParentRepo: Repository<StudentParent>;
  let parentRepo: Repository<Parent>;
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
    studentParentRepo = ds.getRepository(StudentParent);
    parentRepo = ds.getRepository(Parent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-PL', 'TS-PL2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftoverStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftoverStudents) {
          await studentParentRepo.delete({ studentId: s.id });
        }
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Parents List',
      sigle: 'TS-PL',
      address: '1 Parent Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School PL',
      sigle: 'TS-PL2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminPL',
      phone: '+2250100000680',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminPL',
      phone: '+2250100000681',
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
      lastName: 'AdminPL',
      phone: '+2250100000682',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    // Student in school + parent linked
    const studentUser = await userRepo.save({
      firstName: 'Kader',
      lastName: 'Ouédraogo',
      phone: '+2250100000683',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: 'Terminale A',
    });

    const parentUser = await userRepo.save({
      firstName: 'Aminata',
      lastName: 'Ouédraogo',
      phone: '+2250100000684',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    // Student in otherSchool + parent linked
    const otherStudentUser = await userRepo.save({
      firstName: 'Seydou',
      lastName: 'Traoré',
      phone: '+2250100000685',
      role: UserRole.STUDENT,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    const otherStudent = await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: otherSchool.id,
      class: 'Première C',
    });

    const otherParentUser = await userRepo.save({
      firstName: 'Fatoumata',
      lastName: 'Traoré',
      phone: '+2250100000686',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const otherParent = await parentRepo.save({ userId: otherParentUser.id });
    await studentParentRepo.save({
      studentId: otherStudent.id,
      parentId: otherParent.id,
    });
  });

  afterAll(async () => {
    const allStudents = await studentRepo.find({
      where: [{ schoolId: school.id }, { schoolId: otherSchool.id }],
    });
    for (const s of allStudents) {
      await studentParentRepo.delete({ studentId: s.id });
    }
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000680',
      '+2250100000681',
      '+2250100000682',
      '+2250100000683',
      '+2250100000684',
      '+2250100000685',
      '+2250100000686',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        if (u.role === UserRole.PARENT)
          await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return all parents for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.meta.total).toBeGreaterThanOrEqual(2);
    });

    it('should return only parents linked to own school for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents')
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].user.firstName).toBe('Aminata');
    });

    it('should return only parents linked to other school', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents')
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.data[0].user.firstName).toBe('Fatoumata');
    });

    it('should include user field in response', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      const parent = res.body.data.data[0] as { user: { firstName: string } };
      expect(parent.user).toBeDefined();
      expect(parent.user.firstName).toBeDefined();
    });

    it('should support pagination', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents?page=1&limit=1')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data.length).toBe(1);
      expect(res.body.data.meta.limit).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get('/api/v1/parents');
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT role', async () => {
      const parentUser = await userRepo.findOne({
        where: { phone: '+2250100000684' },
      });
      const token = jwtService.sign({
        sub: parentUser!.id,
        role: UserRole.PARENT,
      });
      const res = await request(getServer(app))
        .get('/api/v1/parents')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });
});
