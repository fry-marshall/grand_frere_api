import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { CardBatch } from '../../src/modules/cards/entities/card-batch.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { CardTemplate } from '../../src/modules/cards/card.types';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('POST /api/v1/cards/batches/:batchId/pdf', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let cardBatchRepo: Repository<CardBatch>;
  let userRepo: Repository<User>;
  let jwtService: JwtService;

  let school: School;
  let batch: CardBatch;
  let superAdminToken: string;
  let schoolAdminToken: string;

  const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content for testing');

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    cardBatchRepo = ds.getRepository(CardBatch);
    userRepo = ds.getRepository(User);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-UBP' } });
    if (leftover) {
      await cardBatchRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School UBP',
      sigle: 'TS-UBP',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+2250100000092',
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
      phone: '+2250100000093',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    batch = await cardBatchRepo.save({
      schoolId: school.id,
      template: CardTemplate.LUFFY,
      count: 5,
    });
  });

  afterAll(async () => {
    await cardBatchRepo.delete({ schoolId: school.id });
    await userRepo.delete({ phone: '+2250100000092' });
    await userRepo.delete({ phone: '+2250100000093' });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should store the PDF and set pdfUrl on the batch', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/cards/batches/${batch.id}/pdf`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', pdfBuffer, {
          filename: 'batch.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.pdfUrl).toBeDefined();
      expect(res.body.data.pdfUrl).toMatch(/^http:\/\/localhost\/storage\//);

      const dbBatch = await cardBatchRepo.findOne({
        where: { id: batch.id },
      });
      expect(dbBatch?.pdfUrl).toBe(res.body.data.pdfUrl);
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when no file is attached', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/cards/batches/${batch.id}/pdf`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 when the file is not a PDF', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/cards/batches/${batch.id}/pdf`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', Buffer.from('not a pdf'), {
          filename: 'batch.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(400);
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/cards/batches/${batch.id}/pdf`)
        .attach('file', pdfBuffer, {
          filename: 'batch.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(401);
    });

    it('should return 403 when user is not SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/cards/batches/${batch.id}/pdf`)
        .set('Authorization', `Bearer ${schoolAdminToken}`)
        .attach('file', pdfBuffer, {
          filename: 'batch.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(403);
    });

    it('should return 404 when the batch does not exist', async () => {
      const res = await request(getServer(app))
        .post('/api/v1/cards/batches/00000000-0000-0000-0000-000000000000/pdf')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .attach('file', pdfBuffer, {
          filename: 'batch.pdf',
          contentType: 'application/pdf',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(ErrorMessages.CARDS.BATCH_NOT_FOUND);
    });
  });
});
