import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

const PHONE_SUCCESS = '+2250100000030';
const PHONE_EXISTING = '+2250500000029';
const TEST_PHONES = [PHONE_SUCCESS, PHONE_EXISTING];

describe('POST /api/v1/auth/signup/vendor', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;

  let school: School;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    vendorWalletRepo = ds.getRepository(VendorWallet);

    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-SV' } });
    if (leftover) {
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'Test School SV',
      sigle: 'TS-SV',
      address: '1 Test Street',
      status: SchoolStatus.ACTIVE,
    });

    await userRepo.save({
      firstName: 'Existing',
      lastName: 'Vendor',
      phone: PHONE_EXISTING,
      role: UserRole.VENDOR,
    });
  });

  afterAll(async () => {
    for (const phone of TEST_PHONES) {
      await userRepo.delete({ phone });
    }
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should create vendor account with wallet and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: PHONE_SUCCESS,
          password: 'SecurePass123',
          shopName: 'Maquis Chez Konan',
          schoolId: school.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      const user = await userRepo.findOne({ where: { phone: PHONE_SUCCESS } });
      expect(user?.role).toBe(UserRole.VENDOR);

      const vendor = await vendorRepo.findOne({
        where: { userId: user!.id },
      });
      expect(vendor).toBeDefined();
      expect(vendor?.shopName).toBe('Maquis Chez Konan');

      const wallet = await vendorWalletRepo.findOne({
        where: { vendorId: vendor!.id },
      });
      expect(wallet).toBeDefined();
      expect(wallet?.balance).toBe(0);
    });

    it('should accept optional waveNumber', async () => {
      const tempPhone = '+2250700000099';
      await userRepo.delete({ phone: tempPhone });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: tempPhone,
          password: 'SecurePass123',
          shopName: 'Maquis Wave',
          schoolId: school.id,
          waveNumber: '+2250700000001',
        });

      expect(res.status).toBe(201);

      const user = await userRepo.findOne({ where: { phone: tempPhone } });
      const vendor = await vendorRepo.findOne({ where: { userId: user!.id } });
      expect(vendor?.waveNumber).toBe('+2250700000001');

      await userRepo.delete({ phone: tempPhone });
    });
  });

  describe('Failure cases', () => {
    it('should return 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({ firstName: 'Konan' });

      expect(res.status).toBe(400);
    });

    it('should return 400 when password is too short', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: '+2250100000031',
          password: 'short',
          shopName: 'Maquis',
          schoolId: school.id,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when phone format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: '+33612345678',
          password: 'SecurePass123',
          shopName: 'Maquis',
          schoolId: school.id,
        });

      expect(res.status).toBe(400);
    });

    it('should return 400 when schoolId is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: '+2250100000031',
          password: 'SecurePass123',
          shopName: 'Maquis',
          schoolId: 'not-a-uuid',
        });

      expect(res.status).toBe(400);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: '+2250100000031',
          password: 'SecurePass123',
          shopName: 'Maquis',
          schoolId: '00000000-0000-0000-0000-000000000000',
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe(ErrorMessages.SCHOOLS.NOT_FOUND);
    });

    it('should return 409 when phone already exists', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/signup/vendor')
        .send({
          firstName: 'Konan',
          lastName: 'Brou',
          phone: PHONE_EXISTING,
          password: 'SecurePass123',
          shopName: 'Maquis',
          schoolId: school.id,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    });
  });
});
