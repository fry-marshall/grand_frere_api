import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';

describe('PATCH /api/v1/students/me', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let studentRepo: Repository<Student>;
  let jwtService: JwtService;

  let studentUser: User;
  let studentToken: string;
  let parentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    studentRepo = ds.getRepository(Student);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-USP' } });
    if (leftover) {
      await studentRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }
    for (const phone of ['+2250100000740', '+2250100000741']) {
      await userRepo.delete({ phone });
    }

    const school = await schoolRepo.save({
      name: 'Update Student Profile School',
      sigle: 'TS-USP',
      address: '1 Profile Street',
      status: SchoolStatus.ACTIVE,
    });

    studentUser = await userRepo.save({
      firstName: 'Original',
      lastName: 'Student',
      phone: '+2250100000740',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'USP',
      phone: '+2250100000741',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
  });

  afterAll(async () => {
    const s = await schoolRepo.findOne({ where: { sigle: 'TS-USP' } });
    if (s) {
      await studentRepo.delete({ schoolId: s.id });
      await userRepo.delete({ schoolId: s.id });
      await schoolRepo.delete({ id: s.id });
    }
    for (const phone of ['+2250100000740', '+2250100000741']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should update firstName', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.firstName).toBe('Updated');
    });

    it('should update lastName', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ lastName: 'Renamed' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.lastName).toBe('Renamed');
    });

    it('should accept empty body (no-op)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({});

      expect(res.status).toBe(200);
    });

    it('should return correct response shape', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: 'Shape' });

      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('schoolId');
      expect(data).toHaveProperty('user');
      expect(data.user).toHaveProperty('firstName', 'Shape');
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when role is PARENT', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(403);
    });

    it('should return 400 when firstName is empty string', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/students/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ firstName: '' });

      expect(res.status).toBe(400);
    });
  });
});
