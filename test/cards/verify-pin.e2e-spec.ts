import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

describe('POST /api/v1/cards/:code/verify-pin', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let jwtService: JwtService;

  let school: School;
  let card: Card;

  let vendorToken: string;
  let superAdminToken: string;

  const CORRECT_PIN = '1234';

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-VP' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School VP',
      sigle: 'TS-VP',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    const pinHash = await bcrypt.hash(CORRECT_PIN, 10);

    card = await cardRepo.save({
      code: 'GF-TS-VP-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
      pinHash,
      pinAttempts: 0,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'VP',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      cardId: card.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id });
    await cardRepo.update(card.id, { studentId: student.id });
    card.studentId = student.id;

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'VP',
      phone: '+2250100000310',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminVP',
      phone: '+2250100000311',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });
  });

  afterAll(async () => {
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of ['+2250100000310', '+2250100000311']) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  const resetCard = (status: CardStatus, pinAttempts = 0) =>
    cardRepo.update(card.id, { status, pinAttempts });

  describe('Success cases', () => {
    it('should return 200 and reset pinAttempts when PIN is correct', async () => {
      await resetCard(CardStatus.ACTIVE, 1);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: CORRECT_PIN });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .send({ pin: CORRECT_PIN });
      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ pin: CORRECT_PIN });
      expect(res.status).toBe(403);
    });

    it('should return 400 when PIN format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: 'abc' });
      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cards/GF-NONEXISTENT-9999/verify-pin')
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: CORRECT_PIN });
      expect(res.status).toBe(404);
    });

    it('should return 409 when card PIN is not set', async () => {
      await cardRepo.update(card.id, { pinHash: null as unknown as string });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: CORRECT_PIN });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.PIN_NOT_SET);

      const pinHash = await bcrypt.hash(CORRECT_PIN, 10);
      await cardRepo.update(card.id, { pinHash });
    });

    it('should return 401 and increment pinAttempts on wrong PIN', async () => {
      await resetCard(CardStatus.ACTIVE, 0);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: '9999' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.CARDS.PIN_INVALID);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(1);
    });

    it('should return 403 and block the card on the 3rd wrong PIN', async () => {
      await resetCard(CardStatus.ACTIVE, 2);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: '9999' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.CARDS.CARD_BLOCKED);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.status).toBe(CardStatus.BLOCKED);
    });

    it('should return 403 when card is already BLOCKED', async () => {
      await resetCard(CardStatus.BLOCKED, 3);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: CORRECT_PIN });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.CARDS.CARD_BLOCKED);
    });

    it('should return 409 when card is SUSPENDED', async () => {
      await resetCard(CardStatus.SUSPENDED, 0);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/cards/${card.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: CORRECT_PIN });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.NOT_ACTIVE);

      await resetCard(CardStatus.ACTIVE, 0);
    });
  });
});
