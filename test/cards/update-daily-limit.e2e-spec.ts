import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
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

describe('PUT /api/v1/cards/:code/daily-limit', () => {
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
  let unlinkedStudentToken: string;
  let superAdminToken: string;
  let vendorToken: string;

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

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-DL' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School DL',
      sigle: 'TS-DL',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    card = await cardRepo.save({
      code: 'GF-TS-DL-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'DL',
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
      phone: '+2250100000210',
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
      phone: '+2250100000211',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminDL',
      phone: '+2250100000212',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'DL',
      phone: '+2250100000213',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    const unlinkedStudentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'StudentDL',
      phone: '+2250100000214',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: unlinkedStudentUser.id,
      schoolId: school.id,
    });
    unlinkedStudentToken = jwtService.sign({
      sub: unlinkedStudentUser.id,
      role: unlinkedStudentUser.role,
    });
  });

  afterAll(async () => {
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100000210',
      '+2250100000211',
      '+2250100000212',
      '+2250100000213',
      '+2250100000214',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should allow the linked PARENT to update the daily limit', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 3000 });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyLimit).toBe(3000);
    });

    it('should allow the linked STUDENT to update their own card daily limit', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ dailyLimit: 2500 });

      expect(res.status).toBe(200);
      expect(res.body.data.dailyLimit).toBe(2500);
    });

    it('should persist the updated daily limit in the database', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 5000 });

      const updated = await cardRepo.findOne({ where: { id: card.id } });
      expect(updated?.dailyLimit).toBe(5000);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is SUPER_ADMIN', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(403);
    });

    it('should return 403 when user is VENDOR', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT is not linked to the student', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT is not the card owner', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${unlinkedStudentToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/cards/GF-NONEXISTENT-9999/daily-limit')
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(404);
    });

    it('should return 400 when dailyLimit is below minimum (100)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 50 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when dailyLimit exceeds maximum (100000)', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 200000 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when dailyLimit is not an integer', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 1500.5 });

      expect(res.status).toBe(400);
    });

    it('should return 400 when dailyLimit is missing', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${card.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 403 when card has no linked student', async () => {
      const unassigned = await cardRepo.save({
        code: 'GF-TS-DL-0002',
        status: CardStatus.UNASSIGNED,
        schoolId: school.id,
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/cards/${unassigned.code}/daily-limit`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ dailyLimit: 2000 });

      expect(res.status).toBe(403);

      await cardRepo.delete({ id: unassigned.id });
    });
  });
});
