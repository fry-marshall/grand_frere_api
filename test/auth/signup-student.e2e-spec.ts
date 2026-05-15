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
const PHONE_SUCCESS_PIN = '+2250100000011';
const PHONE_CLAIM_SUCCESS = '+2250100000012';
const PHONE_EXISTING = '+2250500000019';
const PHONE_ACTIVE_STUDENT = '+2250500000020';
const TEST_PHONES = [
  PHONE_SUCCESS,
  PHONE_SUCCESS_PIN,
  PHONE_CLAIM_SUCCESS,
  PHONE_EXISTING,
  PHONE_ACTIVE_STUDENT,
];

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
  let unassignedCard3: Card;
  let activeCard: Card;
  let shellCard: Card;

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

    // Card 2: UNASSIGNED → phone conflict case
    unassignedCard2 = await cardRepo.save({
      code: 'GF-SS-003',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card 3: UNASSIGNED → PIN set at activation case
    unassignedCard3 = await cardRepo.save({
      code: 'GF-SS-004',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    // Card ACTIVE with real student (has phone) → card not available case
    activeCard = await cardRepo.save({
      code: 'GF-SS-002',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const existingStudentUser = await userRepo.save({
      firstName: 'Existing',
      lastName: 'Student',
      phone: PHONE_ACTIVE_STUDENT,
      role: UserRole.STUDENT,
      schoolId: school.id,
    });
    await studentRepo.save({
      userId: existingStudentUser.id,
      cardId: activeCard.id,
      schoolId: school.id,
    });

    // Card ACTIVE with shell student (no phone, parent registered first) → claim case
    shellCard = await cardRepo.save({
      code: 'GF-SS-005',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });
    const shellStudentUser = await userRepo.save({
      firstName: 'Shell',
      lastName: 'Student',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: false,
    });
    const shellStudent = await studentRepo.save({
      userId: shellStudentUser.id,
      cardId: shellCard.id,
      schoolId: school.id,
    });
    await cardRepo.update(shellCard.id, { studentId: shellStudent.id });

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

    it('should claim shell student account when parent registered first', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: shellCard.code,
          firstName: 'Kwame',
          lastName: 'Mensah',
          phone: PHONE_CLAIM_SUCCESS,
          password: 'SecurePass123',
          class: '5ème B',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Card should still be ACTIVE (unchanged)
      const updatedCard = await cardRepo.findOne({
        where: { id: shellCard.id },
      });
      expect(updatedCard?.status).toBe(CardStatus.ACTIVE);

      // The shell user should now have the phone and be onboarded
      const user = await userRepo.findOne({
        where: { phone: PHONE_CLAIM_SUCCESS },
      });
      expect(user).toBeDefined();
      expect(user?.isOnboarded).toBe(true);

      // No duplicate student should have been created
      const students = await studentRepo.find({
        where: { cardId: shellCard.id },
      });
      expect(students).toHaveLength(1);
    });

    it('should set pinHash on card when pin is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/student')
        .send({
          cardCode: unassignedCard3.code,
          firstName: 'Awa',
          lastName: 'Diallo',
          phone: PHONE_SUCCESS_PIN,
          password: 'SecurePass123',
          pin: '5678',
        });

      expect(res.status).toBe(201);

      const updatedCard = await cardRepo.findOne({
        where: { id: unassignedCard3.id },
      });
      expect(updatedCard!.status).toBe(CardStatus.ACTIVE);
      expect(updatedCard!.pinHash).not.toBeNull();
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

    it('should return 409 when card is ACTIVE and student already has credentials', async () => {
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
