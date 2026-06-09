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
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('PUT /api/v1/cards/:code/suspend and /activate', () => {
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
  let activeCard: Card;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let ownerParentToken: string;
  let unlinkedParentToken: string;
  let ownerStudentToken: string;
  let unlinkedStudentToken: string;
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

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SA' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School SA',
      sigle: 'TS-SA',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    activeCard = await cardRepo.save({
      code: 'GF-TS-SA-0001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'Test',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      cardId: activeCard.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id });
    await cardRepo.update(activeCard.id, { studentId: student.id });
    activeCard.studentId = student.id;
    ownerStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'Owner',
      phone: '+2250100000110',
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

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+2250100000111',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'Admin',
      phone: '+2250100000112',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const unlinkedParentUser = await userRepo.save({
      firstName: 'Unlinked',
      lastName: 'Parent',
      phone: '+2250100000113',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'Test',
      phone: '+2250100000114',
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
      lastName: 'Student',
      phone: '+2250100000115',
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
      '+2250100000110',
      '+2250100000111',
      '+2250100000113',
      '+2250100000114',
      '+2250100000115',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  const resetCard = (status: CardStatus) =>
    cardRepo.update(activeCard.id, { status });

  describe('PUT /suspend', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to suspend an active card', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.SUSPENDED);
      });

      it('should allow SCHOOL_ADMIN to suspend a card in their school', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.SUSPENDED);
      });

      it('should allow the linked PARENT to suspend their student card', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${ownerParentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.SUSPENDED);
      });

      it('should allow the linked STUDENT to suspend their own card', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${ownerStudentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.SUSPENDED);
      });
    });

    describe('Failure cases', () => {
      it('should return 401 when no token is provided', async () => {
        const res = await request(getServer(app)).put(
          `/api/v1/cards/${activeCard.code}/suspend`,
        );
        expect(res.status).toBe(401);
      });

      it('should return 403 when user is VENDOR', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${vendorToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when PARENT is not linked to the student', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${unlinkedParentToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when STUDENT is not the card owner', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${unlinkedStudentToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 404 when card does not exist', async () => {
        const res = await request(getServer(app))
          .put('/api/v1/cards/GF-NONEXISTENT-9999/suspend')
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });

      it('should return 409 when card is not ACTIVE', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/suspend`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.CARDS.NOT_SUSPENDABLE);
      });
    });
  });

  describe('PUT /activate', () => {
    describe('Success cases', () => {
      it('should allow SUPER_ADMIN to reactivate a suspended card', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.ACTIVE);
      });

      it('should allow the linked PARENT to reactivate their student card', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${ownerParentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.ACTIVE);
      });

      it('should allow the linked STUDENT to reactivate their own card', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${ownerStudentToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(CardStatus.ACTIVE);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 when PARENT is not linked to the student', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${unlinkedParentToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 403 when STUDENT is not the card owner', async () => {
        await resetCard(CardStatus.SUSPENDED);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${unlinkedStudentToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 409 when card is not SUSPENDED', async () => {
        await resetCard(CardStatus.ACTIVE);

        const res = await request(getServer(app))
          .put(`/api/v1/cards/${activeCard.code}/activate`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(ErrorMessages.CARDS.NOT_ACTIVATABLE);
      });
    });
  });
});
