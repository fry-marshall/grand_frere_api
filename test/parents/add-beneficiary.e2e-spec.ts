import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { CardStatus } from '../../src/modules/cards/card.types';

describe('POST /api/v1/parents/me/students', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let parentRepo: Repository<Parent>;
  let studentRepo: Repository<Student>;
  let cardRepo: Repository<Card>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let jwtService: JwtService;

  let school: School;

  let parentToken: string;
  let fullParentToken: string;
  let studentToken: string;

  let cardWithStudent: Card;
  let cardUnassigned: Card;
  let cardWithTwoParents: Card;
  let alreadyLinkedCard: Card;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    parentRepo = ds.getRepository(Parent);
    studentRepo = ds.getRepository(Student);
    cardRepo = ds.getRepository(Card);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-AB' } });
    if (leftover) {
      const leftStudents = await studentRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const s of leftStudents) {
        await studentParentRepo.delete({ studentId: s.id });
        await walletRepo.delete({ studentId: s.id });
      }
      await studentRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    for (const phone of [
      '+2250100000750',
      '+2250100000751',
      '+2250100000752',
      '+2250100000753',
      '+2250100000754',
      '+2250100000755',
      '+2250100000756',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'Add Beneficiary School',
      sigle: 'TS-AB',
      address: '1 Beneficiary Street',
      status: SchoolStatus.ACTIVE,
    });

    // Parent under test — starts with 0 students
    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'AB',
      phone: '+2250100000750',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    // Parent that already has 2 students (should get 409)
    const fullParentUser = await userRepo.save({
      firstName: 'Full',
      lastName: 'Parent',
      phone: '+2250100000751',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const fullParent = await parentRepo.save({ userId: fullParentUser.id });
    fullParentToken = jwtService.sign({
      sub: fullParentUser.id,
      role: fullParentUser.role,
    });

    // Student user (to test 403)
    const stuUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'AB',
      phone: '+2250100000752',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({ sub: stuUser.id, role: stuUser.role });

    // Card with a student (main happy-path card)
    cardWithStudent = await cardRepo.save({
      code: 'AB-CARD-001',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });
    const stuUser1 = await userRepo.save({
      firstName: 'Stu1',
      lastName: 'AB',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: false,
    });
    const stu1 = await studentRepo.save({
      userId: stuUser1.id,
      cardId: cardWithStudent.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: stu1.id });

    // Card UNASSIGNED (no student → 409 CARD_HAS_NO_STUDENT)
    cardUnassigned = await cardRepo.save({
      code: 'AB-CARD-002',
      schoolId: school.id,
      status: CardStatus.UNASSIGNED,
    });

    // Card with student who already has 2 parents
    cardWithTwoParents = await cardRepo.save({
      code: 'AB-CARD-003',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });
    const stuUser2 = await userRepo.save({
      firstName: 'Stu2',
      lastName: 'AB',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: false,
    });
    const stu2 = await studentRepo.save({
      userId: stuUser2.id,
      cardId: cardWithTwoParents.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: stu2.id });

    // Create 2 parents for stu2
    for (const phone of ['+2250100000753', '+2250100000754']) {
      const u = await userRepo.save({
        firstName: 'P',
        lastName: 'Extra',
        phone,
        role: UserRole.PARENT,
        isOnboarded: true,
      });
      const p = await parentRepo.save({ userId: u.id });
      await studentParentRepo.save({ parentId: p.id, studentId: stu2.id });
    }

    // Card already linked to the main parent (to test PARENT_ALREADY_LINKED)
    alreadyLinkedCard = await cardRepo.save({
      code: 'AB-CARD-004',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });
    const stuUser3 = await userRepo.save({
      firstName: 'Stu3',
      lastName: 'AB',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: false,
    });
    const stu3 = await studentRepo.save({
      userId: stuUser3.id,
      cardId: alreadyLinkedCard.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: stu3.id });
    await studentParentRepo.save({ parentId: parent.id, studentId: stu3.id });

    // Build fullParent's 2 students so it hits MAX_STUDENTS_REACHED
    for (const code of ['AB-CARD-005', 'AB-CARD-006']) {
      const c = await cardRepo.save({
        code,
        schoolId: school.id,
        status: CardStatus.ACTIVE,
      });
      const u = await userRepo.save({
        firstName: 'Extra',
        lastName: 'Stu',
        role: UserRole.STUDENT,
        schoolId: school.id,
        isOnboarded: false,
      });
      const s = await studentRepo.save({
        userId: u.id,
        cardId: c.id,
        schoolId: school.id,
      });
      await walletRepo.save({ studentId: s.id });
      await studentParentRepo.save({
        parentId: fullParent.id,
        studentId: s.id,
      });
    }
  });

  afterAll(async () => {
    const s = await schoolRepo.findOne({ where: { sigle: 'TS-AB' } });
    if (s) {
      const students = await studentRepo.find({ where: { schoolId: s.id } });
      for (const st of students) {
        await studentParentRepo.delete({ studentId: st.id });
        await walletRepo.delete({ studentId: st.id });
      }
      await studentRepo.delete({ schoolId: s.id });
      await cardRepo.delete({ schoolId: s.id });
      await userRepo.delete({ schoolId: s.id });
      await schoolRepo.delete({ id: s.id });
    }
    for (const phone of [
      '+2250100000750',
      '+2250100000751',
      '+2250100000752',
      '+2250100000753',
      '+2250100000754',
      '+2250100000755',
      '+2250100000756',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should link a student to the parent and return student info', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: 'AB-CARD-001' });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('schoolId');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user).toHaveProperty('firstName');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .send({ cardCode: 'AB-CARD-001' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when role is STUDENT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ cardCode: 'AB-CARD-001' });

      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: 'DOES-NOT-EXIST' });

      expect(res.status).toBe(404);
    });

    it('should return 409 when card is not ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: cardUnassigned.code });

      expect(res.status).toBe(409);
    });

    it('should return 409 when student already has 2 parents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: cardWithTwoParents.code });

      expect(res.status).toBe(409);
    });

    it('should return 409 when parent is already linked to this student', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: alreadyLinkedCard.code });

      expect(res.status).toBe(409);
    });

    it('should return 409 when parent already has 2 linked students', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${fullParentToken}`)
        .send({ cardCode: cardWithStudent.code });

      expect(res.status).toBe(409);
    });

    it('should return 400 when cardCode is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
