import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { SchoolJoinRequest } from '../../src/modules/school-join-requests/entities/school-join-request.entity';
import { SchoolJoinRequestStatus } from '../../src/modules/school-join-requests/school-join-request.types';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('GET/PUT /api/v1/school-join-requests', () => {
  let app: INestApplication;
  let requestRepo: Repository<SchoolJoinRequest>;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let superAdminToken: string;
  let schoolAdminToken: string;

  let pendingToApprove: SchoolJoinRequest;
  let pendingToReject: SchoolJoinRequest;
  let duplicateSigleRequest: SchoolJoinRequest;
  let alreadyProcessed: SchoolJoinRequest;
  let existingSchool: School;

  const sigles = ['TS-JR2', 'TS-JR3', 'TS-JR4', 'TS-JR5'];
  const phones = ['+2250100009201', '+2250100009202', '+2250100009203'];

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    requestRepo = ds.getRepository(SchoolJoinRequest);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of sigles) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
      await requestRepo.delete({ sigle });
    }
    for (const phone of phones) {
      await userRepo.delete({ phone });
    }

    existingSchool = await schoolRepo.save({
      name: 'Existing School',
      sigle: 'TS-JR3',
      address: '3 Rue Existing',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminJR',
      phone: phones[0],
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminJR',
      phone: phones[1],
      role: UserRole.SCHOOL_ADMIN,
      schoolId: existingSchool.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    pendingToApprove = await requestRepo.save({
      schoolName: 'Ecole To Approve',
      sigle: 'TS-JR2',
      address: '2 Rue Approve',
      contactFirstName: 'Fatou',
      contactLastName: 'Traore',
      contactPhone: phones[2],
      status: SchoolJoinRequestStatus.PENDING,
    });

    pendingToReject = await requestRepo.save({
      schoolName: 'Ecole To Reject',
      sigle: 'TS-JR4',
      address: '4 Rue Reject',
      contactFirstName: 'Yao',
      contactLastName: 'Bamba',
      contactPhone: '+2250100009204',
      status: SchoolJoinRequestStatus.PENDING,
    });

    duplicateSigleRequest = await requestRepo.save({
      schoolName: 'Ecole Duplicate Sigle',
      sigle: existingSchool.sigle,
      address: '5 Rue Duplicate',
      contactFirstName: 'Aya',
      contactLastName: 'Konan',
      contactPhone: '+2250100009205',
      status: SchoolJoinRequestStatus.PENDING,
    });

    alreadyProcessed = await requestRepo.save({
      schoolName: 'Ecole Already Processed',
      sigle: 'TS-JR5',
      address: '6 Rue Processed',
      contactFirstName: 'Kader',
      contactLastName: 'Diallo',
      contactPhone: '+2250100009206',
      status: SchoolJoinRequestStatus.REJECTED,
      rejectionReason: 'Already handled',
    });
  });

  afterAll(async () => {
    for (const sigle of sigles) {
      const school = await schoolRepo.findOne({ where: { sigle } });
      if (school) {
        await userRepo.delete({ schoolId: school.id });
        await schoolRepo.delete({ id: school.id });
      }
      await requestRepo.delete({ sigle });
    }
    for (const phone of [
      ...phones,
      '+2250100009204',
      '+2250100009205',
      '+2250100009206',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('GET /school-join-requests', () => {
    describe('Success cases', () => {
      it('should list join requests for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/school-join-requests')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data.data)).toBe(true);
      });

      it('should filter by status', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/school-join-requests?status=REJECTED')
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(
          res.body.data.data.every(
            (r: { status: string }) => r.status === 'REJECTED',
          ),
        ).toBe(true);
      });
    });

    describe('Failure cases', () => {
      it('should return 403 for SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .get('/api/v1/school-join-requests')
          .set('Authorization', `Bearer ${schoolAdminToken}`);
        expect(res.status).toBe(403);
      });

      it('should return 401 without a token', async () => {
        const res = await request(getServer(app)).get(
          '/api/v1/school-join-requests',
        );
        expect(res.status).toBe(401);
      });
    });
  });

  describe('GET /school-join-requests/:id', () => {
    describe('Success cases', () => {
      it('should return the request for SUPER_ADMIN', async () => {
        const res = await request(getServer(app))
          .get(`/api/v1/school-join-requests/${pendingToApprove.id}`)
          .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.id).toBe(pendingToApprove.id);
      });
    });

    describe('Failure cases', () => {
      it('should return 404 when request does not exist', async () => {
        const res = await request(getServer(app))
          .get(
            '/api/v1/school-join-requests/00000000-0000-0000-0000-000000000000',
          )
          .set('Authorization', `Bearer ${superAdminToken}`);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /school-join-requests/:id/approve', () => {
    describe('Success cases', () => {
      it('should create the school and its admin, and mark the request APPROVED', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-join-requests/${pendingToApprove.id}/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ password: 'SecurePass123' });

        expect(res.status).toBe(200);
        expect(res.body.data.school.sigle).toBe('TS-JR2');
        expect(res.body.data.admin.phone).toBe(pendingToApprove.contactPhone);
        expect(res.body.data.admin.role).toBe(UserRole.SCHOOL_ADMIN);

        const updatedRequest = await requestRepo.findOne({
          where: { id: pendingToApprove.id },
        });
        expect(updatedRequest?.status).toBe(SchoolJoinRequestStatus.APPROVED);

        const signinRes = await request(getServer(app))
          .post('/api/v1/auth/signin')
          .send({
            phone: pendingToApprove.contactPhone,
            password: 'SecurePass123',
          });
        expect(signinRes.status).toBe(200);
        expect(signinRes.body.data.accessToken).toBeDefined();
      });
    });

    describe('Failure cases', () => {
      it('should return 403 for SCHOOL_ADMIN', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-join-requests/${pendingToReject.id}/approve`)
          .set('Authorization', `Bearer ${schoolAdminToken}`)
          .send({ password: 'SecurePass123' });
        expect(res.status).toBe(403);
      });

      it('should return 409 when the sigle already exists and leave the request PENDING', async () => {
        const res = await request(getServer(app))
          .put(
            `/api/v1/school-join-requests/${duplicateSigleRequest.id}/approve`,
          )
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ password: 'SecurePass123' });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOLS.SIGLE_ALREADY_EXISTS,
        );

        const stillPending = await requestRepo.findOne({
          where: { id: duplicateSigleRequest.id },
        });
        expect(stillPending?.status).toBe(SchoolJoinRequestStatus.PENDING);
      });

      it('should return 409 when the request was already processed', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-join-requests/${alreadyProcessed.id}/approve`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ password: 'SecurePass123' });

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_PENDING,
        );
      });

      it('should return 404 when request does not exist', async () => {
        const res = await request(getServer(app))
          .put(
            '/api/v1/school-join-requests/00000000-0000-0000-0000-000000000000/approve',
          )
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ password: 'SecurePass123' });
        expect(res.status).toBe(404);
      });
    });
  });

  describe('PUT /school-join-requests/:id/reject', () => {
    describe('Success cases', () => {
      it('should mark the request REJECTED with a reason', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-join-requests/${pendingToReject.id}/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({ reason: 'Sigle conflict' });

        expect(res.status).toBe(200);
        expect(res.body.data.status).toBe(SchoolJoinRequestStatus.REJECTED);
        expect(res.body.data.rejectionReason).toBe('Sigle conflict');
      });
    });

    describe('Failure cases', () => {
      it('should return 409 when the request was already processed', async () => {
        const res = await request(getServer(app))
          .put(`/api/v1/school-join-requests/${alreadyProcessed.id}/reject`)
          .set('Authorization', `Bearer ${superAdminToken}`)
          .send({});

        expect(res.status).toBe(409);
        expect(res.body.message).toBe(
          ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_PENDING,
        );
      });
    });
  });
});
