import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { CardStatus } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('POST /api/v1/auth/scan-card', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;

  let school: School;
  let unassignedCard: Card;
  let cardWithStudent: Card;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const dataSource = moduleRef.get(DataSource);
    schoolRepo = dataSource.getRepository(School);
    cardRepo = dataSource.getRepository(Card);
    userRepo = dataSource.getRepository(User);
    studentRepo = dataSource.getRepository(Student);

    // Clean up any leftovers from previous runs
    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SCAN' } });
    if (leftover) {
      await studentRepo.delete({ schoolId: leftover.id });
      await cardRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School',
      sigle: 'TS-SCAN',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    unassignedCard = await cardRepo.save({
      code: 'SCAN-UNASSIGNED-001',
      status: CardStatus.UNASSIGNED,
      schoolId: school.id,
    });

    const studentUser = await userRepo.save({
      firstName: 'Alice',
      lastName: 'Doe',
      role: UserRole.STUDENT,
      schoolId: school.id,
    });

    cardWithStudent = await cardRepo.save({
      code: 'SCAN-ACTIVE-001',
      status: CardStatus.ACTIVE,
      schoolId: school.id,
    });

    await studentRepo.save({
      userId: studentUser.id,
      cardId: cardWithStudent.id,
      schoolId: school.id,
    });
  });

  afterAll(async () => {
    await studentRepo.delete({ schoolId: school.id });
    await cardRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return UNASSIGNED status with no student when card is unassigned', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/auth/scan-card')
        .send({ code: unassignedCard.code });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        status: CardStatus.UNASSIGNED,
        student: false,
        requiresStudentInfo: true,
        parents: [false, false],
      });
    });

    it('should return ACTIVE status with student true and no parents', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/auth/scan-card')
        .send({ code: cardWithStudent.code });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        status: CardStatus.ACTIVE,
        student: true,
        requiresStudentInfo: true,
        parents: [false, false],
      });
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when code is missing', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/auth/scan-card')
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 400 when code is not a string', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/auth/scan-card')
        .send({ code: 123 });

      expect(res.status).toBe(400);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/auth/scan-card')
        .send({ code: 'DOES-NOT-EXIST' });

      expect(res.status).toBe(404);
    });
  });
});
