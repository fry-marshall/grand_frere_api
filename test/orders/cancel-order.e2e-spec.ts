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
import { Wallet } from '../../src/modules/wallets/entities/wallet.entity';
import { Transaction } from '../../src/modules/wallets/entities/transaction.entity';
import { Order } from '../../src/modules/orders/entities/order.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { OrderStatus } from '../../src/modules/orders/order.types';

describe('PUT /api/v1/orders/:id/cancel', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let walletRepo: Repository<Wallet>;
  let transactionRepo: Repository<Transaction>;
  let orderRepo: Repository<Order>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherVendor: Vendor;
  let student: Student;
  let otherStudent: Student;
  let wallet: Wallet;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let parentToken: string;
  let studentToken: string;
  let otherStudentToken: string;

  const makeOrder = async (status = OrderStatus.PENDING) =>
    orderRepo.save({
      vendorId: vendor.id,
      studentId: student.id,
      status,
      totalAmount: 500,
      expiresAt: new Date(Date.now() + 900000),
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
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    walletRepo = ds.getRepository(Wallet);
    transactionRepo = ds.getRepository(Transaction);
    orderRepo = ds.getRepository(Order);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-OC', 'TS-OC2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftStudents) {
          const lw = await walletRepo.findOne({ where: { studentId: s.id } });
          if (lw) {
            await transactionRepo.delete({ walletId: lw.id });
            await orderRepo.delete({ studentId: s.id });
            await walletRepo.delete({ id: lw.id });
          }
        }
        await vendorRepo.delete({ schoolId: leftover.id });
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }
    for (const phone of [
      '+2250100005400',
      '+2250100005401',
      '+2250100005402',
      '+2250100005403',
      '+2250100005404',
      '+2250100005405',
      '+2250100005406',
      '+2250100005407',
      '+2250100005408',
    ]) {
      await userRepo.delete({ phone });
    }

    school = await schoolRepo.save({
      name: 'School Cancel Order',
      sigle: 'TS-OC',
      address: '1 Cancel St',
      status: SchoolStatus.ACTIVE,
    });
    otherSchool = await schoolRepo.save({
      name: 'Other School OC',
      sigle: 'TS-OC2',
      address: '2 Cancel St',
      status: SchoolStatus.ACTIVE,
    });

    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminOC',
      phone: '+2250100005400',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    const schoolAdmin = await userRepo.save({
      firstName: 'School',
      lastName: 'AdminOC',
      phone: '+2250100005401',
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
      lastName: 'AdminOC',
      phone: '+2250100005402',
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
      lastName: 'OC',
      phone: '+2250100005403',
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
      shopName: 'Snack OC',
      status: VendorStatus.ACTIVE,
    });

    const otherVendorUser = await userRepo.save({
      firstName: 'OtherVendor',
      lastName: 'OC',
      phone: '+2250100005404',
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
      shopName: 'Other Snack OC',
      status: VendorStatus.ACTIVE,
    });

    const studentUser = await userRepo.save({
      firstName: 'Eleve',
      lastName: 'OC',
      phone: '+2250100005405',
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
    wallet = await walletRepo.save({
      studentId: student.id,
      balance: 5000,
      reserved: 2000,
    });

    const otherStudentUser = await userRepo.save({
      firstName: 'OtherEleve',
      lastName: 'OC',
      phone: '+2250100005406',
      role: UserRole.STUDENT,
      isOnboarded: true,
    });
    otherStudentToken = jwtService.sign({
      sub: otherStudentUser.id,
      role: otherStudentUser.role,
    });
    otherStudent = await studentRepo.save({
      userId: otherStudentUser.id,
      schoolId: school.id,
    });

    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'OC',
      phone: '+2250100005407',
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

    void otherVendor;
    void otherStudent;
  });

  afterAll(async () => {
    await transactionRepo.delete({ walletId: wallet.id });
    await orderRepo.delete({ studentId: student.id });
    await walletRepo.delete({ id: wallet.id });
    await studentParentRepo.delete({ studentId: student.id });
    await studentRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: school.id });
    await vendorRepo.delete({ schoolId: otherSchool.id });
    for (const phone of [
      '+2250100005400',
      '+2250100005401',
      '+2250100005402',
      '+2250100005403',
      '+2250100005404',
      '+2250100005405',
      '+2250100005406',
      '+2250100005407',
      '+2250100005408',
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
    it('should cancel an order as VENDOR and release wallet reservation', async () => {
      const order = await makeOrder();
      const reservedBefore = (await walletRepo.findOne({
        where: { id: wallet.id },
      }))!.reserved;

      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);

      const updatedWallet = await walletRepo.findOne({
        where: { id: wallet.id },
      });
      expect(updatedWallet!.reserved).toBe(reservedBefore - 500);
      expect(updatedWallet!.balance).toBe(5000);
    });

    it('should cancel an order as SUPER_ADMIN', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel an order as SCHOOL_ADMIN for own school student', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel an order as PARENT for linked student', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${parentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    });

    it('should cancel an order as STUDENT for own order', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${studentToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app)).put(
        `/api/v1/orders/${order.id}/cancel`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN cancels order from another school', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR cancels another vendor order', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT cancels another student order', async () => {
      const order = await makeOrder();
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${otherStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when order does not exist', async () => {
      const res = await request(getServer(app))
        .put('/api/v1/orders/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when order is not pending', async () => {
      const order = await makeOrder(OrderStatus.VALIDATED);
      const res = await request(getServer(app))
        .put(`/api/v1/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
