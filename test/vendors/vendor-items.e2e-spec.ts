import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { VendorWallet } from '../../src/modules/vendors/entities/vendor-wallet.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { Student } from '../../src/modules/students/entities/student.entity';
import { Parent } from '../../src/modules/parents/entities/parent.entity';
import { StudentParent } from '../../src/modules/students/entities/student-parent.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';
import { ItemStatus } from '../../src/modules/items/item.types';

describe('GET /api/v1/vendors/:id/items', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let vendorWalletRepo: Repository<VendorWallet>;
  let itemRepo: Repository<Item>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;
  let vendor: Vendor;
  let otherVendor: Vendor;

  let superAdminToken: string;
  let schoolAdminToken: string;
  let otherSchoolAdminToken: string;
  let vendorToken: string;
  let otherVendorToken: string;
  let studentToken: string;
  let foreignStudentToken: string;
  let parentToken: string;
  let foreignParentToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    vendorWalletRepo = ds.getRepository(VendorWallet);
    itemRepo = ds.getRepository(Item);
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-VI', 'TS-VI2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) {
          await itemRepo.delete({ vendorId: v.id });
          await vendorWalletRepo.delete({ vendorId: v.id });
          await vendorRepo.delete({ id: v.id });
        }
        const leftStudents = await studentRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const s of leftStudents) {
          await studentParentRepo.delete({ studentId: s.id });
        }
        await studentRepo.delete({ schoolId: leftover.id });
        await userRepo.delete({ schoolId: leftover.id });
        await schoolRepo.delete({ id: leftover.id });
      }
    }

    school = await schoolRepo.save({
      name: 'Vendor Items Test School',
      sigle: 'TS-VI',
      address: '1 Items Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other Vendor Items School',
      sigle: 'TS-VI2',
      address: '2 Items Street',
      status: SchoolStatus.ACTIVE,
    });

    // SUPER_ADMIN
    const superAdminUser = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminVI',
      phone: '+2250100000600',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdminUser.id,
      role: superAdminUser.role,
    });

    // SCHOOL_ADMIN — school
    const schoolAdminUser = await userRepo.save({
      firstName: 'Admin',
      lastName: 'VI',
      phone: '+2250100000601',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    schoolAdminToken = jwtService.sign({
      sub: schoolAdminUser.id,
      role: schoolAdminUser.role,
    });

    // SCHOOL_ADMIN — other school
    const otherSchoolAdminUser = await userRepo.save({
      firstName: 'OtherAdmin',
      lastName: 'VI',
      phone: '+2250100000602',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherSchoolAdminUser.id,
      role: otherSchoolAdminUser.role,
    });

    // VENDOR — in school
    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'VI',
      phone: '+2250100000603',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    vendor = await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'La Cantine VI',
      status: VendorStatus.ACTIVE,
    });
    await vendorWalletRepo.save({ vendorId: vendor.id });
    vendorToken = jwtService.sign({
      sub: vendorUser.id,
      role: vendorUser.role,
    });

    // VENDOR — in other school
    const otherVendorUser = await userRepo.save({
      firstName: 'OtherVendor',
      lastName: 'VI',
      phone: '+2250100000604',
      role: UserRole.VENDOR,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherVendor = await vendorRepo.save({
      userId: otherVendorUser.id,
      schoolId: otherSchool.id,
      shopName: 'Other Cantine VI',
      status: VendorStatus.ACTIVE,
    });
    await vendorWalletRepo.save({ vendorId: otherVendor.id });
    otherVendorToken = jwtService.sign({
      sub: otherVendorUser.id,
      role: otherVendorUser.role,
    });

    // STUDENT — in school
    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'VI',
      phone: '+2250100000605',
      role: UserRole.STUDENT,
      schoolId: school.id,
      isOnboarded: true,
    });
    const student = await studentRepo.save({
      userId: studentUser.id,
      schoolId: school.id,
    });
    studentToken = jwtService.sign({
      sub: studentUser.id,
      role: studentUser.role,
    });

    // PARENT — linked to student above
    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'VI',
      phone: '+2250100000606',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    const parent = await parentRepo.save({ userId: parentUser.id });
    await studentParentRepo.save({
      studentId: student.id,
      parentId: parent.id,
    });
    parentToken = jwtService.sign({
      sub: parentUser.id,
      role: parentUser.role,
    });

    // STUDENT — in other school
    const foreignStudentUser = await userRepo.save({
      firstName: 'Foreign',
      lastName: 'StudentVI',
      phone: '+2250100000607',
      role: UserRole.STUDENT,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    await studentRepo.save({
      userId: foreignStudentUser.id,
      schoolId: otherSchool.id,
    });
    foreignStudentToken = jwtService.sign({
      sub: foreignStudentUser.id,
      role: foreignStudentUser.role,
    });

    // PARENT — with no child in school
    const foreignParentUser = await userRepo.save({
      firstName: 'Foreign',
      lastName: 'ParentVI',
      phone: '+2250100000608',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    await parentRepo.save({ userId: foreignParentUser.id });
    foreignParentToken = jwtService.sign({
      sub: foreignParentUser.id,
      role: foreignParentUser.role,
    });

    // Items for vendor
    await itemRepo.save([
      {
        vendorId: vendor.id,
        name: 'Thiéboudienne',
        price: 1500,
        description: 'Riz au poisson',
        status: ItemStatus.ACTIVE,
      },
      {
        vendorId: vendor.id,
        name: 'Yassa Poulet',
        price: 1200,
        description: 'Poulet mariné',
        status: ItemStatus.ACTIVE,
      },
      {
        vendorId: vendor.id,
        name: 'Plat retiré',
        price: 500,
        description: 'Non disponible',
        status: ItemStatus.INACTIVE,
      },
    ]);
  });

  afterAll(async () => {
    for (const sigle of ['TS-VI', 'TS-VI2']) {
      const s = await schoolRepo.findOne({ where: { sigle } });
      if (!s) continue;
      const vendors = await vendorRepo.find({ where: { schoolId: s.id } });
      for (const v of vendors) {
        await itemRepo.delete({ vendorId: v.id });
        await vendorWalletRepo.delete({ vendorId: v.id });
        await vendorRepo.delete({ id: v.id });
      }
      const students = await studentRepo.find({ where: { schoolId: s.id } });
      for (const st of students) {
        await studentParentRepo.delete({ studentId: st.id });
      }
      await studentRepo.delete({ schoolId: s.id });
      await userRepo.delete({ schoolId: s.id });
      await schoolRepo.delete({ id: s.id });
    }
    for (const phone of [
      '+2250100000600',
      '+2250100000601',
      '+2250100000602',
      '+2250100000603',
      '+2250100000604',
      '+2250100000605',
      '+2250100000606',
      '+2250100000607',
      '+2250100000608',
    ]) {
      const u = await userRepo.findOne({ where: { phone } });
      if (u) {
        await parentRepo.delete({ userId: u.id });
        await userRepo.delete({ id: u.id });
      }
    }
    await app.close();
  });

  describe('Success cases', () => {
    it('should return only ACTIVE items for STUDENT in same school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(
        res.body.data.every((i: { status: string }) => i.status === 'ACTIVE'),
      ).toBe(true);
    });

    it('should return only ACTIVE items for PARENT with child in same school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(
        res.body.data.every((i: { status: string }) => i.status === 'ACTIVE'),
      ).toBe(true);
    });

    it('should return items with correct shape', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      const item = res.body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('vendorId', vendor.id);
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('price');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('imageUrl');
      expect(item).toHaveProperty('status', 'ACTIVE');
      expect(item).toHaveProperty('createdAt');
    });

    it('should return own items for VENDOR', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${vendorToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return items for SCHOOL_ADMIN of same school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${schoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return items for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should return empty list when vendor has no active items', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${otherVendor.id}/items`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/vendors/${vendor.id}/items`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when STUDENT is from another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${foreignStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT has no child in the vendor school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${foreignParentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when VENDOR accesses another vendor items', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${otherVendorToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when SCHOOL_ADMIN accesses vendor from another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/vendors/${vendor.id}/items`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when vendor does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/vendors/00000000-0000-0000-0000-000000000000/items')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });
  });
});
