import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
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
  let parent: Parent;
  let studentToken: string;

  let cardWithStudent: Card;
  let cardUnassigned: Card;
  let cardUnassignedNoFields: Card;
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
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'Add Beneficiary School',
      sigle: 'TS-AB',
      address: '1 Beneficiary Street',
      status: SchoolStatus.ACTIVE,
    });

    // Parent under test
    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'AB',
      phone: '+2250100000750',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parent = await parentRepo.save({ userId: parentUser.id });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    // Student user (to test 403)
    const stuUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'AB',
      phone: '+2250100000751',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({ sub: stuUser.id, role: stuUser.role });

    // Card with an existing student
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

    // Unassigned card — no student (create student flow)
    cardUnassigned = await cardRepo.save({
      code: 'AB-CARD-002',
      schoolId: school.id,
      status: CardStatus.UNASSIGNED,
    });

    // Another unassigned card — used to test missing firstName/lastName
    cardUnassignedNoFields = await cardRepo.save({
      code: 'AB-CARD-007',
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
    for (const phone of ['+2250100000752', '+2250100000753']) {
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

    // Card already linked to the main parent
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
    it('should link an existing student to the parent', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: cardWithStudent.code });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('schoolId');
      expect(res.body.data.user).toHaveProperty('firstName', 'Stu1');
    });

    it('should create a new student when card is UNASSIGNED', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({
          cardCode: cardUnassigned.code,
          firstName: 'Nouveau',
          lastName: 'Eleve',
          class: 'CE2',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.firstName).toBe('Nouveau');
      expect(res.body.data.user.lastName).toBe('Eleve');
      expect(res.body.data.class).toBe('CE2');
      expect(res.body.data.schoolId).toBe(school.id);
    });

    it('should allow a parent to add more than 2 students', async () => {
      // Parent already has stu3 (alreadyLinked) + stu1 (cardWithStudent) + the one from UNASSIGNED
      // Adding a 4th card should succeed
      const extraCard = await cardRepo.save({
        code: 'AB-CARD-EXTRA',
        schoolId: school.id,
        status: CardStatus.ACTIVE,
      });
      const extraUser = await userRepo.save({
        firstName: 'Extra',
        lastName: 'Student',
        role: UserRole.STUDENT,
        schoolId: school.id,
        isOnboarded: false,
      });
      const extraStudent = await studentRepo.save({
        userId: extraUser.id,
        cardId: extraCard.id,
        schoolId: school.id,
      });
      await walletRepo.save({ studentId: extraStudent.id });

      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: extraCard.code });

      expect(res.status).toBe(201);

      await studentParentRepo.delete({ studentId: extraStudent.id });
      await walletRepo.delete({ studentId: extraStudent.id });
      await studentRepo.delete({ id: extraStudent.id });
      await userRepo.delete({ id: extraUser.id });
      await cardRepo.delete({ id: extraCard.id });
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .send({ cardCode: cardWithStudent.code });

      expect(res.status).toBe(401);
    });

    it('should return 403 when role is STUDENT', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ cardCode: cardWithStudent.code });

      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: 'DOES-NOT-EXIST' });

      expect(res.status).toBe(404);
    });

    it('should return 400 when card is UNASSIGNED and firstName/lastName are missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: cardUnassignedNoFields.code });

      expect(res.status).toBe(400);
    });

    it('should return 409 when student already has 2 parents', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: cardWithTwoParents.code });

      expect(res.status).toBe(409);
    });

    it('should return 409 when parent is already linked to this student', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ cardCode: alreadyLinkedCard.code });

      expect(res.status).toBe(409);
    });

    it('should return 400 when cardCode is missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/parents/me/students')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
