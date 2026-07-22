import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../data-source';
import { School } from '../../modules/schools/entities/school.entity';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/user.types';
import { SchoolStatus } from '../../modules/schools/school.types';

const SCHOOL_SIGLE = 'LGB';
const ADMIN_PHONE = '+2250170959931';
const ADMIN_PASSWORD = 'Marshal1998';

async function seed() {
  await AppDataSource.initialize();

  const schoolRepo = AppDataSource.getRepository(School);
  const userRepo = AppDataSource.getRepository(User);

  let school = await schoolRepo.findOne({ where: { sigle: SCHOOL_SIGLE } });
  if (!school) {
    school = await schoolRepo.save({
      name: 'Lycée Gaston Berger',
      sigle: SCHOOL_SIGLE,
      address: 'Dakar, Sénégal',
      status: SchoolStatus.ACTIVE,
    });
    console.log(`School created: ${school.name} (${school.sigle})`);
  } else {
    console.log(`School found: ${school.name} (${school.sigle})`);
  }

  const existingUser = await userRepo.findOne({
    where: { phone: ADMIN_PHONE },
  });

  if (existingUser) {
    console.log('School admin already exists — skipping.');
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await userRepo.save({
    firstName: 'Admin',
    lastName: 'LGB',
    phone: ADMIN_PHONE,
    passwordHash,
    role: UserRole.SCHOOL_ADMIN,
    schoolId: school.id,
    isOnboarded: true,
    isPhoneVerified: true,
  });

  console.log(`School admin created: ${ADMIN_PHONE} for ${school.name}`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
