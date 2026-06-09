import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('GET /api/v1/wallets/student/:studentId', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let student: Student;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let parentToken: string;
  let unlinkedParentToken: string;
  let studentToken: string;
  let otherStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-WAL', 'TS-WAL2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await walletRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await studentParentRepo
          .createQueryBuilder()
          .delete()
          .where(
            '"studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid)',
            { sid: leftover.id },
          )
          .execute();
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100001100',
      '+2250100001101',
      '+2250100001102',
      '+2250100001103',
      '+2250100001104',
      '+2250100001105',
      '+2250100001106',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Wallet',
      sigle: 'TS-WAL',
      address: '1 Wallet St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School Wallet',
      sigle: 'TS-WAL2',
      address: '2 Wallet St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminWal',
      phone: '+2250100001100',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const adminUser = await userRepo.save({
      firstName: 'Admin',
      lastName: 'WalletSch',
      phone: '+2250100001101',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: adminUser.id,
      role: adminUser.role,
    });

    const otherAdminUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminWal',
      phone: '+2250100001102',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdminUser.id,
      role: otherAdminUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Awa',
      lastName: 'StudentWal',
      phone: '+2250100001103',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: 'CM2',
    });
    await walletRepo.save({
      studentId: student.id,
      balance: 5000,
      reserved: 500,
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'StudentWal',
      phone: '+2250100001104',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
    await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: school.id,
      class: 'CE1',
    });

    const parentUser = await userRepo.save({
      firstName: 'Marc',
      lastName: 'ParentWal',
      phone: '+2250100001105',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'ParentWal',
      phone: '+2250100001106',
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
    await walletRepo.delete({ studentId: student.id });
    await studentParentRepo
      .createQueryBuilder()
      .delete()
      .where(
        '"studentId" IN (SELECT id FROM students WHERE "schoolId" = :sid)',
        { sid: school.id },
      )
      .execute();
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100001100',
      '+2250100001101',
      '+2250100001102',
      '+2250100001103',
      '+2250100001104',
      '+2250100001105',
      '+2250100001106',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return wallet for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.studentId).toBe(student.id);
      expect(res.body.data.balance).toBe(5000);
      expect(res.body.data.reserved).toBe(500);
    });

    it('should return wallet for SCHOOL_ADMIN of same school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.studentId).toBe(student.id);
    });

    it('should return wallet for linked PARENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.studentId).toBe(student.id);
    });

    it('should return wallet for own STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.studentId).toBe(student.id);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/wallets/student/${student.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 for SCHOOL_ADMIN of another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for unlinked PARENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 for STUDENT accessing another student wallet', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${student.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/wallets/student/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when wallet does not exist for the student', async () => {
      const noWalletStudentUser = await userRepo.save({
        firstName: 'NoWallet',
        lastName: 'Student',
        phone: '+2250100009999',
        role: UserRole.STUDENT,
        isOnboarded: true,
      });
      const noWalletStudent = await studentRepo.save({
        userId: noWalletStudentUser.id,
        schoolId: school.id,
      });
      const res = await request(getServer(app))
        .get(`/api/v1/wallets/student/${noWalletStudent.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      await studentRepo.delete({ id: noWalletStudent.id });
      await userRepo.delete({ phone: '+2250100009999' });
      expect(res.status).toBe(404);
    });
  });
});
