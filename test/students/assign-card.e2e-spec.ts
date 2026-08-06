import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('PUT /api/v1/students/:id/assign-card', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let studentWithoutCard: Student;
  let studentWithCard: Student;
  let unassignedCard: Card;
  let unassignedCardOtherSchool: Card;
  let activeCard: Card;

  let superAdminToken: string;
  let ownStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SAC', 'TS-SAC2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await cardRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'School Assign Card',
      sigle: 'TS-SAC',
      address: '1 Assign Street',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School SAC',
      sigle: 'TS-SAC2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSAC',
      phone: '+2250100000710',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Abou',
      lastName: 'Fofana',
      phone: '+2250100000711',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownStudentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    studentWithoutCard = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      class: '1ère A',
    });

    unassignedCard = await cardRepo.save({
      code: 'GF-TS-SAC-0001',
      schoolId: school.id,
      status: CardStatus.UNASSIGNED,
    });
    activeCard = await cardRepo.save({
      code: 'GF-TS-SAC-0002',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });
    unassignedCardOtherSchool = await cardRepo.save({
      code: 'GF-TS-SAC2-0001',
      schoolId: otherSchool.id,
      status: CardStatus.UNASSIGNED,
    });

    const studentUserWithCard = await userRepo.save({
      firstName: 'Aicha',
      lastName: 'Sylla',
      phone: '+2250100000712',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    studentWithCard = await studentRepo.save({
      userId: studentUserWithCard.id,
      schoolId: school.id,
      cardId: activeCard.id,
      class: '1ère B',
    });
    await cardRepo.update(activeCard.id, { studentId: studentWithCard.id });
  });

  afterAll(async () => {
    await studentRepo.delete({ schoolId: school.id });
    await studentRepo.delete({ schoolId: otherSchool.id });
    await cardRepo.delete({ schoolId: school.id });
    await cardRepo.delete({ schoolId: otherSchool.id });
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    for (const phone of [
      '+2250100000710',
      '+2250100000711',
      '+2250100000712',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should assign an unassigned card of the same school to a student without one', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${studentWithoutCard.id}/assign-card`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: unassignedCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data.card.code).toBe(unassignedCard.code);
      expect(res.body.data.card.status).toBe(CardStatus.ACTIVE);

      const updatedCard = await cardRepo.findOne({
        where: { id: unassignedCard.id },
      });
      expect(updatedCard?.status).toBe(CardStatus.ACTIVE);
      expect(updatedCard?.studentId).toBe(studentWithoutCard.id);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${studentWithCard.id}/assign-card`)
        .send({ cardCode: unassignedCardOtherSchool.code });
      expect(res.status).toBe(401);
    });

    it('should return 403 when STUDENT role', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${studentWithCard.id}/assign-card`)
        .set('Authorization', `Bearer ${ownStudentToken}`)
        .send({ cardCode: unassignedCardOtherSchool.code });
      expect(res.status).toBe(403);
    });

    it('should return 409 when student already has a card', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/students/${studentWithCard.id}/assign-card`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: unassignedCardOtherSchool.code });
      expect(res.status).toBe(409);
    });

    it('should return 404 when card does not exist', async () => {
      const otherStudentUser = await userRepo.save({
        firstName: 'Temp0',
        lastName: 'NoCard',
        phone: '+2250100000715',
        role: UserRole.STUDENT,
        schoolId: school.id,
        isOnboarded: true,
      });
      const otherStudent = await studentRepo.save({
        userId: otherStudentUser.id,
        schoolId: school.id,
        class: '2nde E',
      });

      const res = await request(getServer(app))
        .put(`/api/v1/students/${otherStudent.id}/assign-card`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: 'GF-NOPE-9999' });
      expect(res.status).toBe(404);

      await studentRepo.delete({ id: otherStudent.id });
      await userRepo.delete({ id: otherStudentUser.id });
    });

    it('should return 409 when card belongs to another school', async () => {
      const otherStudentUser = await userRepo.save({
        firstName: 'Temp',
        lastName: 'NoCard',
        phone: '+2250100000713',
        role: UserRole.STUDENT,
        schoolId: school.id,
        isOnboarded: true,
      });
      const otherStudent = await studentRepo.save({
        userId: otherStudentUser.id,
        schoolId: school.id,
        class: '2nde C',
      });

      const res = await request(getServer(app))
        .put(`/api/v1/students/${otherStudent.id}/assign-card`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: unassignedCardOtherSchool.code });
      expect(res.status).toBe(409);

      await studentRepo.delete({ id: otherStudent.id });
      await userRepo.delete({ id: otherStudentUser.id });
    });

    it('should return 409 when card is not unassigned', async () => {
      const otherStudentUser = await userRepo.save({
        firstName: 'Temp2',
        lastName: 'NoCard',
        phone: '+2250100000714',
        role: UserRole.STUDENT,
        schoolId: school.id,
        isOnboarded: true,
      });
      const otherStudent = await studentRepo.save({
        userId: otherStudentUser.id,
        schoolId: school.id,
        class: '2nde D',
      });

      const res = await request(getServer(app))
        .put(`/api/v1/students/${otherStudent.id}/assign-card`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: activeCard.code });
      expect(res.status).toBe(409);

      await studentRepo.delete({ id: otherStudent.id });
      await userRepo.delete({ id: otherStudentUser.id });
    });

    it('should return 404 when student does not exist', async () => {
      const res = await request(getServer(app))
        .put(
          '/api/v1/students/00000000-0000-0000-0000-000000000000/assign-card',
        )
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ cardCode: unassignedCard.code });
      expect(res.status).toBe(404);
    });
  });
});
