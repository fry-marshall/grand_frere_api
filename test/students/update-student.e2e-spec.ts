import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('PUT /api/v1/students/:id', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let linkedParentToken: string;
  let unlinkedParentToken: string;
  let studentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-UPD', 'TS-UPD2']) {
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
    for (const phone of [
      '+2250100000750',
      '+2250100000751',
      '+2250100000752',
      '+2250100000753',
      '+2250100000754',
      '+2250100000755',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        const p = await parentRepo.findOne({ where: { userId: u.id } });
        if (p) await parentRepo.delete({ id: p.id });
        await userRepo.delete({ id: u.id });
      }
    }

    school = await schoolRepo.save({
      name: 'Update Student School',
      sigle: 'TS-UPD',
      address: '1 Update St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other Update School',
      sigle: 'TS-UPD2',
      address: '2 Update St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminUPD',
      phone: '+2250100000750',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminUPD',
      phone: '+2250100000751',
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
      lastName: 'AdminUPD',
      phone: '+2250100000752',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Original',
      lastName: 'StudentUPD',
      phone: '+2250100000753',
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

    const linkedParentUser = await userRepo.save({
      firstName: 'Linked',
      lastName: 'ParentUPD',
      phone: '+2250100000754',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    linkedParentToken = jwtService.sign({
      sub: linkedParentUser.id,
      role: linkedParentUser.role,
    });
    const linkedParent = await parentRepo.save({ userId: linkedParentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: linkedParent.id,
    });

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'ParentUPD',
      phone: '+2250100000755',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });
    await parentRepo.save({ userId: unlinkedParentUser.id });
  });

  afterAll(async () => {
    await studentParentRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000750',
      '+2250100000751',
      '+2250100000752',
      '+2250100000753',
      '+2250100000754',
      '+2250100000755',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should update student for SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ firstName: 'UpdatedBySuperAdmin' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.firstName).toBe('UpdatedBySuperAdmin');
    });

    it('should update student for own SCHOOL_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`)
        .send({ lastName: 'UpdatedByAdmin' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.lastName).toBe('UpdatedByAdmin');
    });

    it('should update student for linked PARENT', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${linkedParentToken}`)
        .send({ firstName: 'UpdatedByParent' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.firstName).toBe('UpdatedByParent');
    });

    it('should accept empty body (no-op)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});

      expect(res.status).toBe(200);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('should return 403 for STUDENT role', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 403 for SCHOOL_ADMIN of another school', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 403 for unlinked PARENT', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/students/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when firstName is empty string', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/students/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ firstName: '' });

      expect(res.status).toBe(400);
    });
  });
});
