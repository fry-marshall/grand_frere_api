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

describe('GET /api/v1/parents/:id/students', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let studentParentRepo: Repository<StudentParent>;
  let parentRepo: Repository<Parent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let parent: Parent;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let ownParentToken: string;
  let otherParentToken: string;

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

    for (const sigle of ['TS-PST', 'TS-PST2']) {
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
      name: 'School Parent Students',
      sigle: 'TS-PST',
      address: '1 PS Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School PST',
      sigle: 'TS-PST2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminPST',
      phone: '+2250100000700',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminPST',
      phone: '+2250100000701',
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
      lastName: 'AdminPST',
      phone: '+2250100000702',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Rokia',
      lastName: 'Sanogo',
      phone: '+2250100000703',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    ownParentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    parent = await parentRepo.save({ userId: parentUser.id });

    const studentUser = await userRepo.save({
      firstName: 'Drissa',
      lastName: 'Sanogo',
      phone: '+2250100000704',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '3ème B',
    });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    const otherParentUser = await userRepo.save({
      firstName: 'Salimata',
      lastName: 'Bamba',
      phone: '+2250100000705',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    otherParentToken = jwtService.sign({
      sub: otherParentUser.id,
      role: otherParentUser.role,
    });
    await parentRepo.save({ userId: otherParentUser.id });
  });

  afterAll(async () => {
    const students = await studentRepo.find({ where: { schoolId: school.id } });
    for (const s of students) {
      await studentParentRepo.delete({ studentId: s.id });
    }
    await studentRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000700',
      '+2250100000701',
      '+2250100000702',
      '+2250100000703',
      '+2250100000704',
      '+2250100000705',
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
    it('should return students for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}/students`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].user.firstName).toBe('Drissa');
      expect(res.body.data[0].class).toBe('3ème B');
      expect(res.body.data[0].schoolId).toBe(school.id);
    });

    it('should return students for SCHOOL_ADMIN whose school has a linked student', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}/students`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should return own students for PARENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}/students`)
        .set('Authorization', `Bearer ${ownParentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should return empty list for parent with no students', async () => {
      const emptyParent = await parentRepo.findOne({
        where: {
          userId: (await userRepo.findOne({
            where: { phone: '+2250100000705' },
          }))!.id,
        },
      });
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${emptyParent!.id}/students`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/parents/${parent.id}/students`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN has no student linked to this parent', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}/students`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT accesses another parent students', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/parents/${parent.id}/students`)
        .set('Authorization', `Bearer ${otherParentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when parent does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/parents/00000000-0000-0000-0000-000000000000/students')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
