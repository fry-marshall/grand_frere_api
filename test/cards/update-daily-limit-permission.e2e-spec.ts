import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
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

describe('PUT /api/v1/cards/:code/daily-limit-permission', () => {
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

  let ownerParentToken: string;
  let unlinkedParentToken: string;
  let ownerStudentToken: string;
  let superAdminToken: string;

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

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-DLP' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School DLP',
      sigle: 'TS-DLP',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    card = await cardRepo.save({
      code: 'GF-TS-DLP-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'DLP',
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
    ownerStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'Owner',
      phone: '+2250100000220',
      role: UserRole.PARENT,
      isOnboarded: true,
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

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'Parent',
      phone: '+2250100000221',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminDLP',
      phone: '+2250100000222',
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
    for (const phone of [
      '+2250100000220',
      '+2250100000221',
      '+2250100000222',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should allow the linked PARENT to forbid the student from editing the daily limit', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(200);
      expect(res.body.data.studentCanEditDailyLimit).toBe(false);
    });

    it('should persist the updated permission in the database', async () => {
      await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ studentCanEditDailyLimit: true });

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.studentCanEditDailyLimit).toBe(true);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is STUDENT', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(403);
    });

    it('should return 403 when user is SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT is not linked to the student', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/cards/GF-NONEXISTENT-9999/daily-limit-permission')
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(404);
    });

    it('should return 400 when studentCanEditDailyLimit is not a boolean', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ studentCanEditDailyLimit: 'not-a-boolean' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when studentCanEditDailyLimit is missing', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/cards/${card.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 403 when card has no linked student', async () => {
      const unassigned = await cardRepo.save({
        code: 'GF-TS-DLP-0002',
        status: CardStatus.UNASSIGNED,
        schoolId: school.id,
      });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${unassigned.code}/daily-limit-permission`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ studentCanEditDailyLimit: false });

      expect(res.status).toBe(403);

      await cardRepo.delete({ id: unassigned.id });
    });
  });
});
