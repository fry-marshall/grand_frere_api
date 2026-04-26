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
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('PUT /api/v1/cards/:code/reset-pin', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let jwtService: JwtService;

  let school: School;
  let card: Card;

  let ownerStudentToken: string;
  let ownerParentToken: string;
  let unlinkedStudentToken: string;
  let unlinkedParentToken: string;
  let vendorToken: string;

  const PASSWORD = 'Password123!';

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
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-RP' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School RP',
      sigle: 'TS-RP',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    card = await cardRepo.save({
      code: 'GF-TS-RP-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
      pinHash: await bcrypt.hash('0000', 10),
      pinAttempts: 0,
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'RP',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
      passwordHash,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      cardId: card.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id });
    await cardRepo.update(card.id, { studentId: student.id });
    card.studentId = student.id;
    ownerStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'RP',
      phone: '+2250100000410',
      role: UserRole.PARENT,
      isOnboarded: true,
      passwordHash,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });
    ownerParentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const unlinkedStudentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'StudentRP',
      phone: '+2250100000411',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
      passwordHash,
    });
    await studentRepo.save({
      userId: unlinkedStudentUser.id,
      schoolId: school.id,
    });
    unlinkedStudentToken = jwtService.sign({
      sub: unlinkedStudentUser.id,
      role: unlinkedStudentUser.role,
    });

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'ParentRP',
      phone: '+2250100000412',
      role: UserRole.PARENT,
      isOnboarded: true,
      passwordHash,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'RP',
      phone: '+2250100000413',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
  });

  afterAll(async () => {
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100000410',
      '+2250100000411',
      '+2250100000412',
      '+2250100000413',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should allow the linked STUDENT to reset their PIN', async () => {
      await cardRepo.update(card.id, {
        status: CardStatus.ACTIVE,
        pinAttempts: 0,
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: PASSWORD, newPin: '5678' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(0);
    });

    it('should allow the linked PARENT to reset the PIN', async () => {
      await cardRepo.update(card.id, {
        status: CardStatus.ACTIVE,
        pinAttempts: 0,
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ password: PASSWORD, newPin: '4321' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(0);
    });

    it('should unblock and reset PIN when card is BLOCKED (STUDENT)', async () => {
      await cardRepo.update(card.id, {
        status: CardStatus.BLOCKED,
        pinAttempts: 3,
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: PASSWORD, newPin: '9999' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(0);
    });

    it('should unblock and reset PIN when card is BLOCKED (PARENT)', async () => {
      await cardRepo.update(card.id, {
        status: CardStatus.BLOCKED,
        pinAttempts: 3,
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ password: PASSWORD, newPin: '1111' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.pinAttempts).toBe(0);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .send({ password: PASSWORD, newPin: '1234' });
      expect(res.status).toBe(401);
    });

    it('should return 403 when user is VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ password: PASSWORD, newPin: '1234' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT is not the card owner', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${unlinkedStudentToken}`)
        .send({ password: PASSWORD, newPin: '1234' });
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT is not linked to the student', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ password: PASSWORD, newPin: '1234' });
      expect(res.status).toBe(403);
    });

    it('should return 401 when password is wrong', async () => {
      await cardRepo.update(card.id, { status: CardStatus.ACTIVE });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: 'WrongPassword!', newPin: '1234' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe(ErrorMessages.CARDS.INVALID_PASSWORD);
    });

    it('should return 400 when newPin format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: PASSWORD, newPin: 'abc' });
      expect(res.status).toBe(400);
    });

    it('should return 400 when newPin is missing', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/reset-pin`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: PASSWORD });
      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/cards/GF-NONEXISTENT-9999/reset-pin')
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ password: PASSWORD, newPin: '1234' });
      expect(res.status).toBe(404);
    });
  });
});
