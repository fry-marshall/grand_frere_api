import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Otp } from '../../src/modules/otp/entities/otp.entity';
import { OtpType } from '../../src/modules/otp/otp.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';
import * as bcrypt from 'bcrypt';

const PHONE = '+2250100000052';

describe('POST /api/v1/auth/forgot-password', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let otpRepo: Repository<Otp>;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    otpRepo = ds.getRepository(Otp);

    await userRepo.delete({ phone: PHONE });
    await userRepo.save({
      firstName: 'Test',
      lastName: 'User',
      phone: PHONE,
      passwordHash: await bcrypt.hash('OldPass123', 10),
      role: UserRole.PARENT,
      isOnboarded: true,
    });
  });

  afterAll(async () => {
    await otpRepo.delete({ phone: PHONE });
    await userRepo.delete({ phone: PHONE });
    await app.close();
  });

  it('should return an OTP code for a known phone', async () => {
    const res = await request(getServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({ phone: PHONE });

    expect(res.status).toBe(200);
    expect(res.body.data.code).toMatch(/^\d{6}$/);

    const otp = await otpRepo.findOne({
      where: { phone: PHONE, type: OtpType.PASSWORD_RESET, isUsed: false },
    });
    expect(otp).not.toBeNull();
  });

  it('should invalidate previous OTP when a new one is requested', async () => {
    const first = await request(getServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({ phone: PHONE });

    const second = await request(getServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({ phone: PHONE });

    expect(second.status).toBe(200);

    const active = await otpRepo.find({
      where: { phone: PHONE, type: OtpType.PASSWORD_RESET, isUsed: false },
    });
    expect(active).toHaveLength(1);
    expect(active[0].code).toBe(second.body.data.code);
    expect(active[0].code).not.toBe(first.body.data.code);
  });

  it('should return 404 for unknown phone', async () => {
    const res = await request(getServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({ phone: '+2250199999999' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ErrorMessages.USERS.NOT_FOUND);
  });

  it('should return 400 for invalid phone format', async () => {
    const res = await request(getServer(app))
      .post('/api/v1/auth/forgot-password')
      .send({ phone: '0000' });

    expect(res.status).toBe(400);
  });
});
