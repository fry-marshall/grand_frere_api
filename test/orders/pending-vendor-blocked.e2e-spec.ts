import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { Card } from '../../src/modules/cards/entities/card.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import { CardStatus } from '../../src/modules/cards/card.types';
import { OrderStatus } from '../../src/modules/orders/order.types';
import { ErrorMessages } from '../../src/common/swagger/error-messages';

describe('Orders access is blocked for a PENDING vendor (menu stays open)', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let itemRepo: Repository<Item>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let cardRepo: Repository<Card>;
  let jwtService: JwtService;

  let school: School;
  let pendingVendor: Vendor;
  let student: Student;
  let card: Card;
  let wallet: Wallet;
  let item: Item;

  let pendingVendorToken: string;

  const makeOrder = (status: OrderStatus) =>
    orderRepo.save({
      vendorId: pendingVendor.id,
      studentId: student.id,
      status,
      totalAmount: 500,
      expiresAt: new Date(Date.now() + 3600000),
      scheduledFor: new Date().toISOString().slice(0, 10),
    });

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    itemRepo = ds.getRepository(Item);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    cardRepo = ds.getRepository(Card);
    jwtService = moduleRef.get(JwtService, { strict: false });

    await cardRepo.delete({ code: 'PENDVENDOR001' });
    for (const sigle of ['TS-PVB']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of ['+2250100008200', '+2250100008201']) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Pending Vendor',
      sigle: 'TS-PVB',
      address: '1 Pending St',
      status: SchoolStatus.ACTIVE,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Pending',
      lastName: 'Vendor',
      phone: '+2250100008200',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    pendingVendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });
    pendingVendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack Pending',
      status: VendorStatus.PENDING,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'PVB',
      phone: '+2250100008201',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });

    card = await cardRepo.save({
      code: 'PENDVENDOR001',
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

    item = await itemRepo.save({
      vendorId: pendingVendor.id,
      name: 'Alloco',
      price: 500,
      status: ItemStatus.ACTIVE,
    });
  });

  afterAll(async () => {
    await orderRepo.delete({ vendorId: pendingVendor.id });
    await itemRepo.delete({ vendorId: pendingVendor.id });
    await walletRepo.delete({ id: wallet.id });
    await cardRepo.delete({ id: card.id });
    await studentRepo.delete({ id: student.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of ['+2250100008200', '+2250100008201']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  describe('Orders access — blocked while PENDING', () => {
    it('should return 403 with NOT_ACTIVE on GET /orders', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on GET /orders/:id', async () => {
      const order = await makeOrder(OrderStatus.PENDING);
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on POST /orders/vendor/:vendorId', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/orders/vendor/${pendingVendor.id}`)
        .set('Authorization', `Bearer ${pendingVendorToken}`)
        .send({
          studentId: student.id,
          items: [{ itemId: item.id, quantity: 1 }],
        });
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on PUT /orders/:id/validate', async () => {
      const order = await makeOrder(OrderStatus.PENDING);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/validate`)
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on PUT /orders/:id/complete', async () => {
      const order = await makeOrder(OrderStatus.VALIDATED);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/complete`)
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on PUT /orders/:id/cancel', async () => {
      const order = await makeOrder(OrderStatus.PENDING);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on GET /orders/by-card', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-card')
        .query({ cardCode: card.code })
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on GET /orders/by-code', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/by-code')
        .query({ code: '1234' })
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });

    it('should return 403 with NOT_ACTIVE on GET /vendors/:id/orders', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${pendingVendor.id}/orders`)
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(ErrorMessages.VENDORS.NOT_ACTIVE);
    });
  });

  describe('Menu access — stays open while PENDING', () => {
    it('should allow GET /items for the pending vendor', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/items')
        .set('Authorization', `Bearer ${pendingVendorToken}`);
      expect(res.status).toBe(200);
    });

    it('should allow POST /items/vendor/:vendorId for the pending vendor', async () => {
      const res = await request(getServer(app))
        .post(`/api/v1/items/vendor/${pendingVendor.id}`)
        .set('Authorization', `Bearer ${pendingVendorToken}`)
        .send({ name: 'Riz sauce', price: 700 });
      expect(res.status).toBe(201);
      expect(res.body.data.vendorId).toBe(pendingVendor.id);

      await itemRepo.delete({ id: res.body.data.id });
    });

    it('should allow PUT /items/:id for the pending vendor', async () => {
      const res = await request(getServer(app))
        .put(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${pendingVendorToken}`)
        .send({ price: 550 });
      expect(res.status).toBe(200);
      expect(res.body.data.price).toBe(550);
    });
  });
});
