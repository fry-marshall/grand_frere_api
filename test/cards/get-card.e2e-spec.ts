import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('GET /api/v1/cards/:code', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let parentRepo: Repository<Parent>;
  let studentRepo: Repository<Student>;
  let studentParentRepo: Repository<StudentParent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let card: Card;
  let studentCard: Card;
  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let parentToken: string;
  let linkedParentToken: string;
  let studentToken: string;
  let otherStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    parentRepo = ds.getRepository(Parent);
    studentRepo = ds.getRepository(Student);
    studentParentRepo = ds.getRepository(StudentParent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-GC', 'TS-GC2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await userRepo.delete({ schoolId: leftover.id });
        await cardRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'Test School GC',
      sigle: 'TS-GC',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Test School GC2',
      sigle: 'TS-GC2',
      address: '2 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    card = await cardRepo.save({
      code: 'GF-TS-GC-0001',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+2250100000100',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'Admin',
      phone: '+2250100000101',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const otherSchoolAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'Admin',
      phone: '+2250100000102',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherSchoolAdmin.id,
      role: otherSchoolAdmin.role,
    });

    // Unlinked parent — registered in parents table but not linked to any student
    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'Test',
      phone: '+2250100000103',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    await parentRepo.save({ userId: parentUser.id });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    // Student card with a student assigned to it
    studentCard = await cardRepo.save({
      code: 'GF-TS-GC-0002',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'Test',
      phone: '+2250100000104',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      cardId: studentCard.id,
      schoolId: school.id,
    });
    await cardRepo.update(studentCard.id, { studentId: student.id });
    studentCard = { ...studentCard, studentId: student.id };
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    // Parent linked to the student
    const linkedParentUser = await userRepo.save({
      firstName: 'Linked',
      lastName: 'Parent',
      phone: '+2250100000105',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const linkedParent = await parentRepo.save({ userId: linkedParentUser.id });
    await studentParentRepo.save({
      parentId: linkedParent.id,
      studentId: student.id,
    });
    linkedParentToken = jwtService.sign({
      sub: linkedParentUser.id,
      role: linkedParentUser.role,
    });

    // Student who does NOT own studentCard
    const otherStudentUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'Student',
      phone: '+2250100000106',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: school.id,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
  });

  afterAll(async () => {
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ phone: '+2250100000100' });
    await userRepo.delete({ phone: '+2250100000103' });
    await userRepo.delete({ phone: '+2250100000105' });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return card details to SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${card.code}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe(card.code);
      expect(res.body.data.status).toBe(CardStatus.UNASSIGNED);
      expect(res.body.data.schoolId).toBe(school.id);
      expect(res.body.data.dailyLimit).toBe(1000);
    });

    it('should return card details to SCHOOL_ADMIN of the same school', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${card.code}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe(card.code);
    });

    it('should return card details to PARENT linked to the card student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${studentCard.code}`)
        .set('Authorization', `Bearer ${linkedParentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe(studentCard.code);
    });

    it('should return card details to STUDENT who owns the card', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${studentCard.code}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.code).toBe(studentCard.code);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer()).get(
        `/api/v1/cards/${card.code}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when PARENT is not linked to the card student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${studentCard.code}`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT does not own the card', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${studentCard.code}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN tries to access a card from another school', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/cards/${card.code}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cards/GF-NONEXISTENT-9999')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(ErrorMessages.CARDS.NOT_FOUND);
    });
  });
});
