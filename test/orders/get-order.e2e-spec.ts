import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { OrderItem } from '../../src/modules/orders/entities/order-item.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('GET /api/v1/orders/:id', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let itemRepo: Repository<Item>;
  let walletRepo: Repository<Wallet>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;
  let order: Order;
  let item: Item;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;
  let studentToken: string;
  let otherStudentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    itemRepo = ds.getRepository(Item);
    walletRepo = ds.getRepository(Wallet);
    orderRepo = ds.getRepository(Order);
    orderItemRepo = ds.getRepository(OrderItem);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-OD', 'TS-OD2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftStudents) {
          await orderRepo.delete({ studentId: s.id });
          await walletRepo.delete({ studentId: s.id });
        }
        await itemRepo.delete({
          vendorId:
            (await vendorRepo.findOne({ where: { schoolId: leftover.id } }))
              ?.id ?? '',
        });
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100005200',
      '+2250100005201',
      '+2250100005202',
      '+2250100005203',
      '+2250100005204',
      '+2250100005205',
      '+2250100005206',
      '+2250100005207',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Get Order',
      sigle: 'TS-OD',
      address: '1 Get Order St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School OD',
      sigle: 'TS-OD2',
      address: '2 Get Order St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminOD',
      phone: '+2250100005200',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminOD',
      phone: '+2250100005201',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdmin.id,
      role: schoolAdmin.role,
    });

    const otherSchoolAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminOD',
      phone: '+2250100005202',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherSchoolAdmin.id,
      role: otherSchoolAdmin.role,
    });

    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'OD',
      phone: '+2250100005203',
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
      shopName: 'Snack OD',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'OtherVendor',
      lastName: 'OD',
      phone: '+2250100005204',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Snack OD',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'OD',
      phone: '+2250100005205',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });
    student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
    await walletRepo.save({ studentId: student.id, balance: 0 });

    const otherStudentUser = await userRepo.save({
      firstName: 'OtherEleve',
      lastName: 'OD',
      phone: '+2250100005206',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'OD',
      phone: '+2250100005207',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });

    item = await itemRepo.save({
      vendorId: vendor.id,
      name: 'Sandwich OD',
      price: 500,
      status: ItemStatus.ACTIVE,
    });

    order = await orderRepo.save({
      vendorId: vendor.id,
      studentId: student.id,
      status: OrderStatus.PENDING,
      totalAmount: 1000,
      expiresAt: new Date(Date.now() + 900000),
      scheduledFor: new Date().toISOString().slice(0, 10),
    });
    await orderItemRepo.save({
      orderId: order.id,
      itemId: item.id,
      quantity: 2,
      unitPrice: 500,
    });
  });

  afterAll(async () => {
    await orderItemRepo.delete({ orderId: order.id });
    await orderRepo.delete({ vendorId: vendor.id });
    await orderRepo.delete({ vendorId: otherVendor.id });
    await walletRepo.delete({ studentId: student.id });
    await studentParentRepo.delete({ studentId: student.id });
    await itemRepo.delete({ vendorId: vendor.id });
    await studentRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    for (const phone of [
      '+2250100005200',
      '+2250100005201',
      '+2250100005202',
      '+2250100005203',
      '+2250100005204',
      '+2250100005205',
      '+2250100005206',
      '+2250100005207',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u?.role === UserRole.PARENT)
        await parentRepo.delete({ userId: u.id });
      await userRepo.delete({ phone });
    }
    await userRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: otherSchool.id });
    await schoolRepo.delete({ id: school.id });
    await schoolRepo.delete({ id: otherSchool.id });
    await app.close();
  });

  describe('Success cases', () => {
    it('should return order details for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.totalAmount).toBe(1000);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].quantity).toBe(2);
      expect(res.body.data.items[0].unitPrice).toBe(500);
      expect(res.body.data.items[0].name).toBeDefined();
    });

    it('should return order details for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
      expect(res.body.data.items.length).toBe(1);
    });

    it('should return order details for own VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
    });

    it('should return order details for PARENT of linked student', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
    });

    it('should return order details for own STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(order.id);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/orders/${order.id}`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 404 when order does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/orders/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 403 when SCHOOL_ADMIN accesses order from another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor order', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another student order', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/orders/${order.id}`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });
  });
});
