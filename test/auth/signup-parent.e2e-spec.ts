import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

const PHONE_SUCCESS_ACTIVE = '+2250100000001';
const PHONE_SUCCESS_UNASSIGNED = '+2250100000003';
const PHONE_EXISTING = '+2250500000099';
const PHONE_PARENT1 = '+2250700000010';
const PHONE_PARENT2 = '+2250700000011';
const TEST_PHONES = [
  PHONE_SUCCESS_ACTIVE,
  PHONE_SUCCESS_UNASSIGNED,
  PHONE_EXISTING,
  PHONE_PARENT1,
  PHONE_PARENT2,
];

const BASE_PAYLOAD = {
  firstName: 'Aminata',
  lastName: 'Koné',
  password: 'SecurePass123',
  studentFirstName: 'Kouassi',
  studentLastName: 'Yao',
};

describe('POST /api/v1/auth/signup/parent', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;

  let school: School;
  let activeCard: Card;
  let unassignedCard: Card;
  let unassignedCardNoStudent: Card;
  let suspendedCard: Card;
  let fullCard: Card;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);

    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SPA' } });
    if (leftover) {
      const leftStudents = await studentRepo.find({
        where: { schoolId: leftover.id },
      });
      for (const s of leftStudents) {
        await walletRepo.delete({ studentId: s.id });
      }
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School SP',
      sigle: 'TS-SPA',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    // Card ACTIVE with a student — parent link flow
    activeCard = await cardRepo.save({
      code: 'GF-SP-001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const studentUser1 = await userRepo.save({
      firstName: 'Student',
      lastName: 'One',
      role: UserRole.STUDENT,
      schoolId: school.id,
    });
    const student1 = await studentRepo.save({
      userId: studentUser1.id,
      cardId: activeCard.id,
      schoolId: school.id,
    });
    await cardRepo.update(activeCard.id, { studentId: student1.id });
    await walletRepo.save({ studentId: student1.id, balance: 0, reserved: 0 });

    // Card UNASSIGNED — student creation flow
    unassignedCard = await cardRepo.save({
      code: 'GF-SP-004',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card UNASSIGNED — used only for failure test (missing student fields)
    unassignedCardNoStudent = await cardRepo.save({
      code: 'GF-SP-005',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card SUSPENDED
    suspendedCard = await cardRepo.save({
      code: 'GF-SP-002',
      status: CardStatus.SUSPENDED,
      schoolId: school.id,
    });

    // Card ACTIVE with 2 parents — too many parents
    fullCard = await cardRepo.save({
      code: 'GF-SP-003',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const studentUser2 = await userRepo.save({
      firstName: 'Student',
      lastName: 'Two',
      role: UserRole.STUDENT,
      schoolId: school.id,
    });
    const student2 = await studentRepo.save({
      userId: studentUser2.id,
      cardId: fullCard.id,
      schoolId: school.id,
    });
    await cardRepo.update(fullCard.id, { studentId: student2.id });
    const parentUser1 = await userRepo.save({
      firstName: 'Parent',
      lastName: 'One',
      phone: PHONE_PARENT1,
      role: UserRole.PARENT,
    });
    const parentUser2 = await userRepo.save({
      firstName: 'Parent',
      lastName: 'Two',
      phone: PHONE_PARENT2,
      role: UserRole.PARENT,
    });
    const parent1 = await parentRepo.save({ userId: parentUser1.id });
    const parent2 = await parentRepo.save({ userId: parentUser2.id });
    await studentParentRepo.save({
      studentId: student2.id,
      parentId: parent1.id,
    });
    await studentParentRepo.save({
      studentId: student2.id,
      parentId: parent2.id,
    });

    await userRepo.save({
      firstName: 'Existing',
      lastName: 'User',
      phone: PHONE_EXISTING,
      role: UserRole.PARENT,
    });
  });

  afterAll(async () => {
    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    const students = await studentRepo.find({ where: { schoolId: school.id } });
    for (const s of students) {
      await walletRepo.delete({ studentId: s.id });
    }
    await userRepo.delete({ schoolId: school.id });
    await cardRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should link parent to existing student when card is ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: activeCard.code,
          phone: PHONE_SUCCESS_ACTIVE,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('should create student + wallet + activate card and return tokens when card is UNASSIGNED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: unassignedCard.code,
          phone: PHONE_SUCCESS_UNASSIGNED,
          studentClass: '6ème A',
          pin: '1234',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();

      const updatedCard = await cardRepo.findOne({
        where: { id: unassignedCard.id },
      });
      expect(updatedCard!.status).toBe(CardStatus.ACTIVE);
      expect(updatedCard!.studentId).not.toBeNull();
      expect(updatedCard!.pinHash).not.toBeNull();

      const student = await studentRepo.findOne({
        where: { cardId: unassignedCard.id },
      });
      expect(student).not.toBeNull();
      expect(student!.class).toBe('6ème A');

      const studentUser = await userRepo.findOne({
        where: { id: student!.userId },
      });
      expect(studentUser!.firstName).toBe('Kouassi');
      expect(studentUser!.phone).toBeNull();

      const wallet = await walletRepo.findOne({
        where: { studentId: student!.id },
      });
      expect(wallet).not.toBeNull();
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({ firstName: 'Aminata' });

      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: 'NONEXISTENT',
          phone: '+2250100000002',
        });

      expect(res.status).toBe(404);
    });

    it('should return 400 when card is UNASSIGNED and student fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: unassignedCardNoStudent.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: '+2250100000099',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(ErrorMessages.AUTH.STUDENT_FIELDS_REQUIRED);
    });

    it('should return 409 when card is SUSPENDED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: suspendedCard.code,
          phone: '+2250100000002',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.CARD_NOT_ACTIVE);
    });

    it('should return 409 when phone already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: activeCard.code,
          phone: PHONE_EXISTING,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    });

    it('should return 409 when student already has 2 parents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          ...BASE_PAYLOAD,
          cardCode: fullCard.code,
          phone: '+2250100000002',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        ErrorMessages.AUTH.STUDENT_ALREADY_HAS_TWO_PARENTS,
      );
    });
  });
});
