import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import request from 'supertest';
import { createTestApp } from '../helpers/create-app';
import { User } from '../../src/modules/users/entities/user.entity';
import { Otp } from '../../src/modules/otp/entities/otp.entity';
import { OtpType } from '../../src/modules/otp/otp.types';
import { UserRole } from '../../src/modules/users/user.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';
import * as bcrypt from 'bcrypt';

const PHONE = '+2250100000051';

describe('POST /api/v1/auth/reset-password', () => {
  let app: INestApplication;
  let userRepo: Repository<User>;
  let otpRepo: Repository<Otp>;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    userRepo = ds.getRepository(User);
    otpRepo = ds.getRepository(Otp);

    await otpRepo.delete({ phone: PHONE });
    await userRepo.delete({ phone: PHONE });
    await userRepo.save({
      firstName: 'Test',
      lastName: 'Reset',
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

  it('should reset password with a valid OTP', async () => {
    const forgotRes = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ phone: PHONE });
    const { code } = forgotRes.body.data;

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ phone: PHONE, code, newPassword: 'NewSecurePass123' });

    expect(res.status).toBe(200);

    const signinRes = await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ phone: PHONE, password: 'NewSecurePass123' });
    expect(signinRes.status).toBe(200);

    const otp = await otpRepo.findOne({
      where: { phone: PHONE, code, type: OtpType.PASSWORD_RESET },
    });
    expect(otp!.isUsed).toBe(true);
  });

  it('should return 401 for wrong OTP code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ phone: PHONE, code: '000000', newPassword: 'NewSecurePass123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(ErrorMessages.AUTH.OTP_INVALID_OR_EXPIRED);
  });

  it('should return 401 when OTP is already used', async () => {
    const forgotRes = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ phone: PHONE });
    const { code } = forgotRes.body.data;

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ phone: PHONE, code, newPassword: 'AnotherPass123' });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ phone: PHONE, code, newPassword: 'YetAnotherPass123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe(ErrorMessages.AUTH.OTP_INVALID_OR_EXPIRED);
  });

  it('should return 400 for invalid OTP format', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ phone: PHONE, code: 'abc', newPassword: 'NewSecurePass123' });

    expect(res.status).toBe(400);
  });
});
