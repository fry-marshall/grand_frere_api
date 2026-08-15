import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, getServer } from '../helpers/create-app';
import { School } from '../../src/modules/schools/entities/school.entity';
import { User } from '../../src/modules/users/entities/user.entity';
import { Vendor } from '../../src/modules/vendors/entities/vendor.entity';
import { Item } from '../../src/modules/items/entities/item.entity';
import { SchoolStatus } from '../../src/modules/schools/school.types';
import { UserRole } from '../../src/modules/users/user.types';
import { VendorStatus } from '../../src/modules/vendors/vendor.types';

describe('Items — blocked vendor (SUSPENDED/REJECTED) cannot mutate its menu', () => {
  let app: INestApplication;
  let schoolRepo: Repository<School>;
  let userRepo: Repository<User>;
  let vendorRepo: Repository<Vendor>;
  let itemRepo: Repository<Item>;
  let jwtService: JwtService;

  let school: School;
  let suspendedVendor: Vendor;
  let rejectedVendor: Vendor;
  let item: Item;

  let suspendedVendorToken: string;
  let rejectedVendorToken: string;

  beforeAll(async () => {
    const { app: nestApp, moduleRef } = await createTestApp();
    app = nestApp;

    const ds = moduleRef.get(DataSource);
    schoolRepo = ds.getRepository(School);
    userRepo = ds.getRepository(User);
    vendorRepo = ds.getRepository(Vendor);
    itemRepo = ds.getRepository(Item);
    jwtService = moduleRef.get(JwtService, { strict: false });

    const leftover = await schoolRepo.findOne({ where: { sigle: 'TS-IBV' } });
    if (leftover) {
      await itemRepo
        .createQueryBuilder()
        .delete()
        .where(
          '"vendorId" IN (SELECT id FROM vendors WHERE "schoolId" = :sid)',
          { sid: leftover.id },
        )
        .execute();
      await vendorRepo.delete({ schoolId: leftover.id });
      await userRepo.delete({ schoolId: leftover.id });
      await schoolRepo.delete({ id: leftover.id });
    }

    school = await schoolRepo.save({
      name: 'School Blocked Vendor',
      sigle: 'TS-IBV',
      address: '1 Blocked St',
      status: SchoolStatus.ACTIVE,
    });

    const suspendedUser = await userRepo.save({
      firstName: 'Suspended',
      lastName: 'VendorIBV',
      phone: '+2250100000740',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    suspendedVendorToken = jwtService.sign({
      sub: suspendedUser.id,
      role: suspendedUser.role,
    });
    suspendedVendor = await vendorRepo.save({
      userId: suspendedUser.id,
      schoolId: school.id,
      shopName: 'Snack Suspended',
      status: VendorStatus.SUSPENDED,
    });

    const rejectedUser = await userRepo.save({
      firstName: 'Rejected',
      lastName: 'VendorIBV',
      phone: '+2250100000741',
      role: UserRole.VENDOR,
      isOnboarded: true,
    });
    rejectedVendorToken = jwtService.sign({
      sub: rejectedUser.id,
      role: rejectedUser.role,
    });
    rejectedVendor = await vendorRepo.save({
      userId: rejectedUser.id,
      schoolId: school.id,
      shopName: 'Snack Rejected',
      status: VendorStatus.REJECTED,
    });

    // Item pre-existing on the suspended vendor's menu (e.g. from before it
    // got suspended), used to check update/delete/image are blocked too.
    item = await itemRepo.save({
      vendorId: suspendedVendor.id,
      name: 'Attiéké poisson',
      price: 1000,
    });
  });

  afterAll(async () => {
    await itemRepo.delete({ vendorId: suspendedVendor.id });
    await itemRepo.delete({ vendorId: rejectedVendor.id });
    await vendorRepo.delete({ schoolId: school.id });
    await userRepo.delete({ schoolId: school.id });
    await schoolRepo.delete({ id: school.id });
    for (const phone of ['+2250100000740', '+2250100000741']) {
      await userRepo.delete({ phone });
    }
    await app.close();
  });

  it('should return 403 when a SUSPENDED vendor creates an item', async () => {
    const res = await request(getServer(app))
      .post(`/api/v1/items/vendor/${suspendedVendor.id}`)
      .set('Authorization', `Bearer ${suspendedVendorToken}`)
      .send({ name: 'Test', price: 100 });
    expect(res.status).toBe(403);
  });

  it('should return 403 when a REJECTED vendor creates an item', async () => {
    const res = await request(getServer(app))
      .post(`/api/v1/items/vendor/${rejectedVendor.id}`)
      .set('Authorization', `Bearer ${rejectedVendorToken}`)
      .send({ name: 'Test', price: 100 });
    expect(res.status).toBe(403);
  });

  it('should return 403 when a SUSPENDED vendor updates an item', async () => {
    const res = await request(getServer(app))
      .put(`/api/v1/items/${item.id}`)
      .set('Authorization', `Bearer ${suspendedVendorToken}`)
      .send({ price: 1200 });
    expect(res.status).toBe(403);
  });

  it('should return 403 when a SUSPENDED vendor uploads an item image', async () => {
    const res = await request(getServer(app))
      .put(`/api/v1/items/${item.id}/image`)
      .set('Authorization', `Bearer ${suspendedVendorToken}`)
      .attach('file', Buffer.from('fake-image'), 'photo.png');
    expect(res.status).toBe(403);
  });

  it('should return 403 when a SUSPENDED vendor deletes an item', async () => {
    const res = await request(getServer(app))
      .delete(`/api/v1/items/${item.id}`)
      .set('Authorization', `Bearer ${suspendedVendorToken}`);
    expect(res.status).toBe(403);

    const stillThere = await itemRepo.findOne({ where: { id: item.id } });
    expect(stillThere).not.toBeNull();
  });

  it('should still allow a SUSPENDED vendor to list and view its own menu', async () => {
    const listRes = await request(getServer(app))
      .get('/api/v1/items')
      .set('Authorization', `Bearer ${suspendedVendorToken}`);
    expect(listRes.status).toBe(200);

    const detailRes = await request(getServer(app))
      .get(`/api/v1/items/${item.id}`)
      .set('Authorization', `Bearer ${suspendedVendorToken}`);
    expect(detailRes.status).toBe(200);
  });
});
