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
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';

describe('GET /api/v1/schools/:id/vendors', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let studentRepo: Repository<Student>;
  let parentRepo: Repository<Parent>;
  let studentParentRepo: Repository<StudentParent>;
  let jwtService: JwtService;

  let school: School;
  let otherSchool: School;

  let superAdminToken: string;
  let ownSchoolAdminToken: string;
  let otherSchoolAdminToken: string;
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
    studentRepo = ds.getRepository(Student);
    parentRepo = ds.getRepository(Parent);
    studentParentRepo = ds.getRepository(StudentParent);
    jwtService = moduleRef.get(JwtService, { strict: false });

    for (const sigle of ['TS-SV', 'TS-SV2']) {
      const leftover = await schoolRepo.findOne({ where: { sigle } });
      if (leftover) {
        const leftVendors = await vendorRepo.find({
          where: { schoolId: leftover.id },
        });
        for (const v of leftVendors) await vendorRepo.delete({ id: v.id });
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
      name: 'School Vendors Test',
      sigle: 'TS-SV',
      address: '1 Vendor Street',
      status: SchoolStatus.ACTIVE,
    });

    otherSchool = await schoolRepo.save({
      name: 'Other School SV',
      sigle: 'TS-SV2',
      address: '2 Other Street',
      status: SchoolStatus.ACTIVE,
    });

    // SUPER_ADMIN
    const superAdmin = await userRepo.save({
      firstName: 'Super',
      lastName: 'AdminSV',
      phone: '+2250100000530',
      role: UserRole.SUPER_ADMIN,
      isOnboarded: true,
    });
    superAdminToken = jwtService.sign({
      sub: superAdmin.id,
      role: superAdmin.role,
    });

    // SCHOOL_ADMIN — own school
    const ownAdmin = await userRepo.save({
      firstName: 'Own',
      lastName: 'AdminSV',
      phone: '+2250100000531',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });
    ownSchoolAdminToken = jwtService.sign({
      sub: ownAdmin.id,
      role: ownAdmin.role,
    });

    // SCHOOL_ADMIN — other school
    const otherAdmin = await userRepo.save({
      firstName: 'Other',
      lastName: 'AdminSV',
      phone: '+2250100000532',
      role: UserRole.SCHOOL_ADMIN,
      schoolId: otherSchool.id,
      isOnboarded: true,
    });
    otherSchoolAdminToken = jwtService.sign({
      sub: otherAdmin.id,
      role: otherAdmin.role,
    });

    // Active vendor in school
    const vendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'One',
      phone: '+2250100000533',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    await vendorRepo.save({
      userId: vendorUser.id,
      schoolId: school.id,
      shopName: 'Snack du Coin',
      status: VendorStatus.ACTIVE,
      openingTime: '08:00',
      closingTime: '17:00',
    });

    // Pending vendor in school (should be hidden from STUDENT/PARENT)
    const pendingVendorUser = await userRepo.save({
      firstName: 'Vendor',
      lastName: 'Pending',
      phone: '+2250100000534',
      role: UserRole.VENDOR,
      schoolId: school.id,
      isOnboarded: true,
    });
    await vendorRepo.save({
      userId: pendingVendorUser.id,
      schoolId: school.id,
      shopName: 'En attente',
      status: VendorStatus.PENDING,
    });

    // STUDENT in school
    const studentUser = await userRepo.save({
      firstName: 'Student',
      lastName: 'SV',
      phone: '+2250100000535',
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

    // PARENT linked to the student above
    const parentUser = await userRepo.save({
      firstName: 'Parent',
      lastName: 'SV',
      phone: '+2250100000536',
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

    // STUDENT in other school
    const foreignStudentUser = await userRepo.save({
      firstName: 'Foreign',
      lastName: 'StudentSV',
      phone: '+2250100000537',
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

    // PARENT with no child in school
    const foreignParentUser = await userRepo.save({
      firstName: 'Foreign',
      lastName: 'ParentSV',
      phone: '+2250100000538',
      role: UserRole.PARENT,
      isOnboarded: true,
    });
    await parentRepo.save({ userId: foreignParentUser.id });
    foreignParentToken = jwtService.sign({
      sub: foreignParentUser.id,
      role: foreignParentUser.role,
    });
  });

  afterAll(async () => {
    for (const sigle of ['TS-SV', 'TS-SV2']) {
      const s = await schoolRepo.findOne({ where: { sigle } });
      if (!s) continue;
      const vendors = await vendorRepo.find({ where: { schoolId: s.id } });
      for (const v of vendors) await vendorRepo.delete({ id: v.id });
      const students = await studentRepo.find({ where: { schoolId: s.id } });
      for (const st of students) {
        await studentParentRepo.delete({ studentId: st.id });
      }
      await studentRepo.delete({ schoolId: s.id });
      await userRepo.delete({ schoolId: s.id });
      await schoolRepo.delete({ id: s.id });
    }
    for (const phone of [
      '+2250100000530',
      '+2250100000531',
      '+2250100000532',
      '+2250100000533',
      '+2250100000534',
      '+2250100000535',
      '+2250100000536',
      '+2250100000537',
      '+2250100000538',
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
    it('should return vendors list for SUPER_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.data)).toBe(true);
      expect(res.body.data.data[0].user).toBeDefined();
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should return vendors list for own SCHOOL_ADMIN', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${ownSchoolAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBe(2);
    });

    it('should return only ACTIVE vendors for STUDENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.data[0].shopName).toBe('Snack du Coin');
      expect(res.body.data.data[0].openingTime).toBe('08:00');
      expect(res.body.data.data[0].closingTime).toBe('17:00');
      expect(res.body.data.data[0].status).toBe('ACTIVE');
    });

    it('should return only ACTIVE vendors for PARENT', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${parentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.total).toBe(1);
      expect(res.body.data.data[0].status).toBe('ACTIVE');
    });

    it('should return empty list for school with no vendors', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${otherSchool.id}/vendors`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.data).toEqual([]);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should respect pagination params', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors?page=1&limit=5`)
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.meta.limit).toBe(5);
      expect(res.body.data.meta.page).toBe(1);
    });
  });

  describe('Failure cases', () => {
    it('should return 401 when no token', async () => {
      const res = await request(getServer(app)).get(
        `/api/v1/schools/${school.id}/vendors`,
      );
      expect(res.status).toBe(401);
    });

    it('should return 403 when SCHOOL_ADMIN accesses another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${otherSchoolAdminToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when STUDENT accesses another school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${foreignStudentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 403 when PARENT has no child in the school', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors`)
        .set('Authorization', `Bearer ${foreignParentToken}`);
      expect(res.status).toBe(403);
    });

    it('should return 404 when school does not exist', async () => {
      const res = await request(getServer(app))
        .get('/api/v1/schools/00000000-0000-0000-0000-000000000000/vendors')
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(404);
    });

    it('should return 400 when pagination params are invalid', async () => {
      const res = await request(getServer(app))
        .get(`/api/v1/schools/${school.id}/vendors?page=0`)
        .set('Authorization', `Bearer ${superAdminToken}`);
      expect(res.status).toBe(400);
    });
  });
});
