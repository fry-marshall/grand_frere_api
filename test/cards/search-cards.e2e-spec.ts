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

describe('GET /api/v1/cards/search', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardRepo: Repository<Card>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let unassignedCard: Card;
  let assignedCard: Card;
  let superAdminToken: string;
  let schoolAdminToken: string;

  const phones = ['+2250100007400', '+2250100007401', '+2250100007402'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardRepo = ds.getRepository(Card);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['SRCH-CARD', 'SRCH-CARD2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await cardRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'Search Card School',
      sigle: 'SRCH-CARD',
      address: '1 Card St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other Card School',
      sigle: 'SRCH-CARD2',
      address: '2 Card St',
      status: SchoolStatus.ACTIVE,
    });

    unassignedCard = await cardRepo.save({
      code: 'SRCH-CARD-0001',
      schoolId: school.id,
      status: CardStatus.UNASSIGNED,
    });

    const studentUser = await userRepo.save({
      firstName: 'Kouassi',
      lastName: "N'Guessan",
      phone: phones[0],
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    assignedCard = await cardRepo.save({
      code: 'SRCH-CARD-0002',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      cardId: assignedCard.id,
      class: '5ème',
    });
    await cardRepo.update(assignedCard.id, { studentId: student.id });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminCard',
      phone: phones[1],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminCard',
      phone: phones[2],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });
  });

  afterAll(async () => {
    for (const sigle of ['SRCH-CARD', 'SRCH-CARD2']) {
      const s = await schoolRepo.findOne({ where: { sigle } });
      if (s) {
        await cardRepo.delete({ schoolId: s.id });
        await studentRepo.delete({ schoolId: s.id });
        await userRepo.delete({ schoolId: s.id });
        await schoolRepo.delete({ id: s.id });
      }
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return paginated cards with school name and no student for unassigned', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/cards/search?schoolId=${school.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(2);
      expect(res.body.data.meta.total).toBe(2);

      const unassigned = res.body.data.data.find(
        (c: { id: string }) => c.id === unassignedCard.id,
      );
      expect(unassigned.schoolName).toBe('Search Card School');
      expect(unassigned.studentId).toBeNull();
      expect(unassigned.studentName).toBeNull();
    });

    it('should join the assigned student name', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/cards/search?schoolId=${school.id}&status=ACTIVE`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toHaveLength(1);
      expect(res.body.data.data[0].id).toBe(assignedCard.id);
      expect(res.body.data.data[0].studentName).toBe("Kouassi N'Guessan");
    });

    it('should filter by code search', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/cards/search?search=0002')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.data.some(
          (c: { id: string }) => c.id === assignedCard.id,
        ),
      ).toBe(true);
    });

    it('should not return cards from another school when filtered', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/cards/search?schoolId=${otherSchool.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 without a token', async () => {
      const res = await request(getServer(app)).get('/api/v1/cards/search');
      expect(res.status).toBe(401);
    });

    it('should return 403 for SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/cards/search')
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(403);
    });
  });
});
