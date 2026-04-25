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
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

// Phones used in this test suite — cleaned up in afterAll and leftover cleanup
const PHONE_SUCCESS = '+2250100000001';
const PHONE_EXISTING = '+2250500000099';
const PHONE_PARENT1 = '+2250700000010';
const PHONE_PARENT2 = '+2250700000011';
const TEST_PHONES = [
  PHONE_SUCCESS,
  PHONE_EXISTING,
  PHONE_PARENT1,
  PHONE_PARENT2,
];

describe('POST /api/v1/auth/signup/parent', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;

  let school: School;
  let activeCard: Card;
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

    // Clean up leftovers from previous runs
    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SP' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    // Seed
    school = await schoolRepo.save({
      name: 'Test School SP',
      sigle: 'TS-SP',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    // Card 1: ACTIVE with a student (no parents) — success case
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
    await studentRepo.save({
      userId: studentUser1.id,
      cardId: activeCard.id,
      schoolId: school.id,
    });

    // Card 2: SUSPENDED — card not active case
    suspendedCard = await cardRepo.save({
      code: 'GF-SP-002',
      status: CardStatus.SUSPENDED,
      schoolId: school.id,
    });

    // Card 3: ACTIVE with a student + 2 parents — too many parents case
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

    // User with existing phone — phone conflict case
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
    await userRepo.delete({ schoolId: school.id });
    await cardRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should create a parent account, link to student, and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: activeCard.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: PHONE_SUCCESS,
          password: 'SecurePass123',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({ firstName: 'Aminata' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: activeCard.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: '+2250100000002',
          password: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: 'NONEXISTENT',
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: '+2250100000002',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(404);
    });

    it('should return 409 when card is not active', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: suspendedCard.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: '+2250100000002',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.CARD_NOT_ACTIVE);
    });

    it('should return 409 when phone already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: activeCard.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: PHONE_EXISTING,
          password: 'SecurePass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    });

    it('should return 409 when student already has 2 parents', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/parent')
        .send({
          cardCode: fullCard.code,
          firstName: 'Aminata',
          lastName: 'Koné',
          phone: '+2250100000002',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(
        ErrorMessages.AUTH.STUDENT_ALREADY_HAS_TWO_PARENTS,
      );
    });
  });
});
