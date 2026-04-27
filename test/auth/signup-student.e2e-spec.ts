import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

const PHONE_SUCCESS = '+2250100000010';
const PHONE_EXISTING = '+2250500000019';
const TEST_PHONES = [PHONE_SUCCESS, PHONE_EXISTING];

describe('POST /api/v1/auth/signup/student', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;

  let school: School;
  let unassignedCard: Card;
  let unassignedCard2: Card;
  let activeCard: Card;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);

    // Clean up leftovers from previous runs
    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SST' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    // Seed
    school = await schoolRepo.save({
      name: 'Test School SS',
      sigle: 'TS-SST',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    // Card 1: UNASSIGNED → success case
    unassignedCard = await cardRepo.save({
      code: 'GF-SS-001',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card 2: UNASSIGNED → phone conflict case (stays unassigned after success test)
    unassignedCard2 = await cardRepo.save({
      code: 'GF-SS-003',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card 3: ACTIVE (already has a student) → card not available case
    activeCard = await cardRepo.save({
      code: 'GF-SS-002',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const existingStudentUser = await userRepo.save({
      firstName: 'Existing',
      lastName: 'Student',
      role: UserRole.STUDENT,
      schoolId: school.id,
    });
    await studentRepo.save({
      userId: existingStudentUser.id,
      cardId: activeCard.id,
      schoolId: school.id,
    });

    // User with existing phone → phone conflict case
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
    it('should create student account, wallet, activate card, and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: unassignedCard.code,
          firstName: 'Kouassi',
          lastName: 'Yao',
          phone: PHONE_SUCCESS,
          password: 'SecurePass123',
          class: '6ème A',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Card should now be ACTIVE
      const updatedCard = await cardRepo.findOne({
        where: { id: unassignedCard.id },
      });
      expect(updatedCard?.status).toBe(CardStatus.ACTIVE);

      // Wallet should have been created
      const user = await userRepo.findOne({ where: { phone: PHONE_SUCCESS } });
      const student = await studentRepo.findOne({
        where: { userId: user!.id },
      });
      const wallet = await walletRepo.findOne({
        where: { studentId: student!.id },
      });
      expect(wallet).toBeDefined();
      expect(wallet?.balance).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({ firstName: 'Kouassi' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: unassignedCard.code,
          firstName: 'Kouassi',
          lastName: 'Yao',
          phone: '+2250100000020',
          password: 'short',
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: 'NONEXISTENT',
          firstName: 'Kouassi',
          lastName: 'Yao',
          phone: '+2250100000020',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(404);
    });

    it('should return 409 when card is not UNASSIGNED', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: activeCard.code,
          firstName: 'Kouassi',
          lastName: 'Yao',
          phone: '+2250100000020',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.CARD_NOT_AVAILABLE);
    });

    it('should return 409 when phone already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: unassignedCard2.code,
          firstName: 'Kouassi',
          lastName: 'Yao',
          phone: PHONE_EXISTING,
          password: 'SecurePass123',
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    });
  });
});
