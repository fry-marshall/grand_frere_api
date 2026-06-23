import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';
import { CardStatus } from '../../src/modules/cards/card.types';

describe('GET /api/v1/orders/by-card', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let cardRepo: Repository<Card>;
  let jwtService: JwtService;

  let school: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;
  let card: Card;
  let wallet: Wallet;

  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    cardRepo = ds.getRepository(Card);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await cardRepo.delete({ code: 'BYCARD001' });
    for (const sigle of ['TS-FBC']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100008100',
      '+2250100008101',
      '+2250100008102',
      '+2250100008103',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School FindByCard',
      sigle: 'TS-FBC',
      address: '1 Card St',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'FBC',
      phone: '+2250100008100',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack FBC',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'Other',
      lastName: 'VendorFBC',
      phone: '+2250100008101',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: school.id,
      shopName: 'Other Snack FBC',
      status: VendorStatus.ACTIVE,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'FBC',
      phone: '+2250100008102',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'FBC',
      phone: '+2250100008103',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });

    card = await cardRepo.save({
      code: 'BYCARD001',
      schoolId: school.id,
      status: CardStatus.ACTIVE,
    });

    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
      cardId: card.id,
    });
    await cardRepo.update(card.id, { studentId: student.id });

    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 5000,
      reserved: 0,
    });
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: vendor.id });
    await orderRepo.delete({ vendorId: otherVendor.id });
    await walletRepo.delete({ id: wallet.id });
    await cardRepo.delete({ id: card.id });
    await studentRepo.delete({ id: student.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of [
      '+2250100008100',
      '+2250100008101',
      '+2250100008102',
      '+2250100008103',
    ]) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return the VALIDATED order for the student scanned by the vendor', async () => {
      const order = await orderRepo.save({
        vendorId: vendor.id,
        studentId: student.id,
        status: OrderStatus.VALIDATED,
        totalAmount: 1200,
        expiresAt: new Date(Date.now() + 3600000),
        scheduledFor: new Date().toISOString().slice(0, 10),
      });

      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: 'BYCARD001' })
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.status).toBe(OrderStatus.VALIDATED);
      expect(res.body.data.totalAmount).toBe(1200);
      expect(Array.isArray(res.body.data.items)).toBe(true);

      await orderRepo.delete({ id: order.id });
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when unauthenticated', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: 'BYCARD001' });
      expect(res.status).toBe(401);
    });

    it('should return 403 when called by PARENT', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: 'BYCARD001' })
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when card does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: 'UNKNOWN99' })
        .set('Authorization', `Bearer ${vendorToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 404 when no VALIDATED order exists for that student at this vendor', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: 'BYCARD001' })
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(404);
    });
  });
});
