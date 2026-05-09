import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../../data-source';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/user.types';

async function seed() {
  const phone = process.env.SUPER_ADMIN_PHONE;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!phone || !password) {
    console.error(
      'SUPER_ADMIN_PHONE and SUPER_ADMIN_PASSWORD must be set in your .env file',
    );
    process.exit(1);
  }

  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const existing = await userRepo.findOne({
    where: { role: UserRole.SUPER_ADMIN },
  });

  if (existing) {
    console.log('Super admin already exists — skipping.');
    await AppDataSource.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await userRepo.save({
    firstName: 'Super',
    lastName: 'Admin',
    phone,
    role: UserRole.SUPER_ADMIN,
    passwordHash,
    isOnboarded: true,
    isPhoneVerified: true,
  });

  console.log(`Super admin created: ${phone}`);
  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
