import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
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

describe('PUT /api/v1/cards/:code/replace', () => {
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
  let otherSchool: School;
  let student: Student;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let ownerParentToken: string;
  let unlinkedParentToken: string;
  let ownerStudentToken: string;
  let unlinkedStudentToken: string;
  let vendorToken: string;

  const PIN = '1234';
  let cardCounter = 0;
  const nextCode = (sigle: string) =>
    `GF-${sigle}-${(++cardCounter).toString().padStart(4, '0')}`;

  const createLostCard = async (schoolId: string) =>
    cardRepo.save({
      code: nextCode('TS-RC'),
      status: CardStatus.ACTIVE,
      schoolId,
      studentId: student.id,
      pinHash: await bcrypt.hash(PIN, 10),
      pinAttempts: 0,
      dailyLimit: 2500,
      studentCanEditDailyLimit: false,
    });

  const createBlankCard = async (schoolId: string) =>
    cardRepo.save({
      code: nextCode('TS-RC'),
      status: CardStatus.UNASSIGNED,
      schoolId,
    });

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

    for (const sigle of ['TS-RC', 'TS-RC2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await userRepo.delete({ schoolId: leftover.id });
        await cardRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'Test School RC',
      sigle: 'TS-RC',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Test School RC2',
      sigle: 'TS-RC2',
      address: '2 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    const initialCard = await createBlankCard(school.id);

    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'RC',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      cardId: initialCard.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id });
    await cardRepo.update(initialCard.id, {
      status: CardStatus.ACTIVE,
      studentId: student.id,
    });
    ownerStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'RC',
      phone: '+2250100000510',
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
      phone: '+2250100000511',
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
      phone: '+2250100000512',
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
      phone: '+2250100000513',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    unlinkedParentToken = jwtService.sign({
      sub: unlinkedParentUser.id,
      role: unlinkedParentUser.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'RC',
      phone: '+2250100000514',
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
      phone: '+2250100000515',
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
    await cardRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    for (const phone of [
      '+2250100000510',
      '+2250100000511',
      '+2250100000512',
      '+2250100000513',
      '+2250100000514',
      '+2250100000515',
    ]) {
      await userRepo.delete({ phone });
    }
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should allow SUPER_ADMIN to replace a lost card with a blank one', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);
      expect(res.body.data.studentId).toBe(student.id);
      expect(res.body.data.dailyLimit).toBe(2500);

      const updatedOld = await cardRepo.findOne({ where: { id: lostCard.id } });
      expect(updatedOld?.status).toBe(CardStatus.LOST);
      expect(updatedOld?.studentId).toBeNull();

      const updatedNew = await cardRepo.findOne({
        where: { id: blankCard.id },
      });
      expect(updatedNew?.pinHash).toBe(lostCard.pinHash);
      expect(updatedNew?.studentCanEditDailyLimit).toBe(false);

      const updatedStudent = await studentRepo.findOne({
        where: { id: student.id },
      });
      expect(updatedStudent?.cardId).toBe(blankCard.id);
    });

    it('should allow SCHOOL_ADMIN to replace a card in their school', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);
    });

    it('should allow the linked PARENT to replace their student card', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${ownerParentToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);
    });

    it('should allow the linked STUDENT to replace their own card', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${ownerStudentToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(CardStatus.ACTIVE);
    });

    it('should carry the PIN over so it still verifies on the new card', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: blankCard.code });

      const res = await request(getServer(app))
        .post(`/api/v1/cards/${blankCard.code}/verify-pin`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ pin: PIN });

      expect(res.status).toBe(200);
    });

    it('should allow replacing a SUSPENDED card', async () => {
      const lostCard = await createLostCard(school.id);
      await cardRepo.update(lostCard.id, { status: CardStatus.SUSPENDED });
      const blankCard = await createBlankCard(school.id);
      await studentRepo.update(student.id, { cardId: lostCard.id });

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(200);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token is provided', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .send({ newCardCode: blankCard.code });
      expect(res.status).toBe(401);
    });

    it('should return 403 when user is VENDOR', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${vendorToken}`)
        .send({ newCardCode: blankCard.code });
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT is not linked to the student', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${unlinkedParentToken}`)
        .send({ newCardCode: blankCard.code });
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT is not the card owner', async () => {
      const lostCard = await createLostCard(school.id);
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${unlinkedStudentToken}`)
        .send({ newCardCode: blankCard.code });
      expect(res.status).toBe(403);
    });

    it('should return 404 when the lost card does not exist', async () => {
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put('/api/v1/cards/GF-NONEXISTENT-9999/replace')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: blankCard.code });
      expect(res.status).toBe(404);
    });

    it('should return 404 when the replacement card does not exist', async () => {
      const lostCard = await createLostCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: 'GF-NONEXISTENT-9999' });
      expect(res.status).toBe(404);
    });

    it('should return 409 when the "lost" card is UNASSIGNED', async () => {
      const unassigned = await createBlankCard(school.id);
      const blankCard = await createBlankCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${unassigned.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: blankCard.code });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.NOT_REPLACEABLE);
    });

    it('should return 409 when the replacement card is the same as the lost card', async () => {
      const lostCard = await createLostCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: lostCard.code });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.SAME_CARD);
    });

    it('should return 409 when the replacement card is not blank', async () => {
      const lostCard = await createLostCard(school.id);
      const notBlank = await createLostCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: notBlank.code });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.NEW_CARD_NOT_BLANK);
    });

    it('should return 409 when the replacement card belongs to another school', async () => {
      const lostCard = await createLostCard(school.id);
      const otherSchoolBlank = await createBlankCard(otherSchool.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ newCardCode: otherSchoolBlank.code });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.CARDS.SCHOOL_MISMATCH);
    });

    it('should return 400 when newCardCode is missing', async () => {
      const lostCard = await createLostCard(school.id);

      const res = await request(getServer(app))
        .put(`/api/v1/cards/${lostCard.code}/replace`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
