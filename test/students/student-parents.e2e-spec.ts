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

describe('GET /api/v1/students/:id/parents', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let studentParentRepo: Repository<StudentParent>;
  let parentRepo: Repository<Parent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;

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
    studentParentRepo = ds.getRepository(StudentParent);
    parentRepo = ds.getRepository(Parent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-STPAR', 'TS-STPAR2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await studentRepo
          .createQueryBuilder()
          .select('id')
          .where('"schoolId" = :sid', { sid: leftover.id })
          .getMany()
          .then(async (students) => {
            for (const s of students) {
              await studentParentRepo.delete({ studentId: s.id });
            }
          });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Student Parents',
      sigle: 'TS-STPAR',
      address: '1 Parents Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School SP',
      sigle: 'TS-STPAR2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSP',
      phone: '+2250100000650',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSP',
      phone: '+2250100000651',
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
      lastName: 'AdminSP',
      phone: '+2250100000652',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Yao',
      lastName: 'Kouakou',
      phone: '+2250100000653',
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

    const otherStudentUser = await userRepo.save({
      firstName: 'Koffi',
      lastName: 'Ange',
      phone: '+2250100000654',
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
      class: '1ère B',
    });

    const parentUser = await userRepo.save({
      firstName: 'Mariam',
      lastName: 'Kouakou',
      phone: '+2250100000655',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });
  });

  afterAll(async () => {
    const students = await studentRepo.find({ where: { schoolId: school.id } });
    for (const s of students) {
      await studentParentRepo.delete({ studentId: s.id });
    }
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000650',
      '+2250100000651',
      '+2250100000652',
      '+2250100000653',
      '+2250100000654',
      '+2250100000655',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        if (u.role === UserRole.PARENT) {
          await parentRepo.delete({ userId: u.id });
        }
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return parents for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/parents`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].user.firstName).toBe('Mariam');
    });

    it('should return parents for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/parents`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should return own parents for STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/parents`)
        .set('Authorization', `Bearer ${ownStudentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });

    it('should return empty list when student has no parents', async () => {
      const otherStudent = await studentRepo.findOne({
        where: { schoolId: otherSchool.id },
      });
      const res = await request(getServer(app))
        .get(`/api/v1/students/${otherStudent!.id}/parents`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/students/${student.id}/parents`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school student', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/parents`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another student parents', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/students/${student.id}/parents`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/students/00000000-0000-0000-0000-000000000000/parents')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
