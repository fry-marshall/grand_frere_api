import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migrations1777110057648 implements MigrationInterface {
  name = 'Migrations1777110057648';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."cards_status_enum" AS ENUM('UNASSIGNED', 'ACTIVE', 'SUSPENDED', 'BLOCKED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "cards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying NOT NULL, "pinHash" character varying, "pinAttempts" integer NOT NULL DEFAULT '0', "status" "public"."cards_status_enum" NOT NULL DEFAULT 'UNASSIGNED', "schoolId" uuid NOT NULL, "studentId" character varying, "imageUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5f3269634705fdff4a9935860fc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_af8c1e25df58bc35de84c8e54e" ON "cards" ("code") `,
    );
    await queryRunner.query(
      `CREATE TABLE "students" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "cardId" uuid, "schoolId" uuid NOT NULL, "class" character varying, CONSTRAINT "UQ_e0208b4f964e609959aff431bf9" UNIQUE ("userId"), CONSTRAINT "UQ_21d19ce21fb1f2ce83140407860" UNIQUE ("cardId"), CONSTRAINT "REL_e0208b4f964e609959aff431bf" UNIQUE ("userId"), CONSTRAINT "REL_21d19ce21fb1f2ce8314040786" UNIQUE ("cardId"), CONSTRAINT "PK_7d7f07271ad4ce999880713f05e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."wallets_currency_enum" AS ENUM('XOF', 'GHS', 'NGN', 'XAF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "studentId" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '0', "reserved" integer NOT NULL DEFAULT '0', "currency" "public"."wallets_currency_enum" NOT NULL DEFAULT 'XOF', CONSTRAINT "UQ_441ee9c3b3bea2beb0554f7bcca" UNIQUE ("studentId"), CONSTRAINT "REL_441ee9c3b3bea2beb0554f7bcc" UNIQUE ("studentId"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vendors_status_enum" AS ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vendors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "schoolId" uuid NOT NULL, "shopName" character varying NOT NULL, "waveNumber" character varying, "status" "public"."vendors_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_d9a5f2ffcbba018f7b35a3cf79f" UNIQUE ("userId"), CONSTRAINT "REL_d9a5f2ffcbba018f7b35a3cf79" UNIQUE ("userId"), CONSTRAINT "PK_9c956c9797edfae5c6ddacc4e6e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."withdrawals_currency_enum" AS ENUM('XOF', 'GHS', 'NGN', 'XAF')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."withdrawals_status_enum" AS ENUM('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "withdrawals" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendorId" uuid NOT NULL, "amount" integer NOT NULL, "currency" "public"."withdrawals_currency_enum" NOT NULL DEFAULT 'XOF', "waveNumber" character varying NOT NULL, "paystackRef" character varying, "status" "public"."withdrawals_status_enum" NOT NULL DEFAULT 'PENDING', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9871ec481baa7755f8bd8b7c7e9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_387a3c5d4511f738c8ca4fd4f3" ON "withdrawals" ("vendorId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('CREDIT', 'DEBIT', 'RESERVE', 'RELEASE')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_currency_enum" AS ENUM('XOF', 'GHS', 'NGN', 'XAF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "walletId" uuid NOT NULL, "type" "public"."transactions_type_enum" NOT NULL, "amount" integer NOT NULL, "currency" "public"."transactions_currency_enum" NOT NULL DEFAULT 'XOF', "balanceBefore" integer NOT NULL, "balanceAfter" integer NOT NULL, "orderId" character varying, "paymentId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a88f466d39796d3081cf96e1b6" ON "transactions" ("walletId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vendor_wallets_currency_enum" AS ENUM('XOF', 'GHS', 'NGN', 'XAF')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vendor_wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendorId" uuid NOT NULL, "balance" integer NOT NULL DEFAULT '0', "currency" "public"."vendor_wallets_currency_enum" NOT NULL DEFAULT 'XOF', "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_a711c79f1801cbb092ab4fc92d5" UNIQUE ("vendorId"), CONSTRAINT "REL_a711c79f1801cbb092ab4fc92d" UNIQUE ("vendorId"), CONSTRAINT "PK_948dcd025d060feb21e9fb43bdb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_devices_platform_enum" AS ENUM('IOS', 'ANDROID')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_devices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "fcmToken" character varying NOT NULL, "deviceId" character varying NOT NULL, "platform" "public"."user_devices_platform_enum" NOT NULL, "appVersion" character varying, "lastSeenAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c9e7e648903a9e537347aba4371" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e12ac4f8016243ac71fd2e415a" ON "user_devices" ("userId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_16f140c105284aa358150582ce" ON "user_devices" ("fcmToken") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e81c41e04269a2d2152f0d60b5" ON "user_devices" ("deviceId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "parents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, CONSTRAINT "UQ_f1e08daeefd9c2e5def5746be7e" UNIQUE ("userId"), CONSTRAINT "REL_f1e08daeefd9c2e5def5746be7" UNIQUE ("userId"), CONSTRAINT "PK_9a4dc67c7b8e6a9cb918938d353" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "student_parents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "studentId" uuid NOT NULL, "parentId" uuid NOT NULL, CONSTRAINT "UQ_00e46933701ebb573ecc435389b" UNIQUE ("studentId", "parentId"), CONSTRAINT "PK_3f3fbf0307e277adf3e90495435" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "isRevoked" boolean NOT NULL DEFAULT false, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens" ("tokenHash") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_currency_enum" AS ENUM('XOF', 'GHS', 'NGN', 'XAF')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'SUCCESS', 'FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "walletId" uuid NOT NULL, "paystackRef" character varying NOT NULL, "amount" integer NOT NULL, "currency" "public"."payments_currency_enum" NOT NULL DEFAULT 'XOF', "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "initiatedBy" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e7bb1ead450db031d9781a48f" ON "payments" ("walletId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_8c031085d1b344bad770be917a" ON "payments" ("paystackRef") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."otps_type_enum" AS ENUM('PHONE_VERIFICATION', 'PASSWORD_RESET')`,
    );
    await queryRunner.query(
      `CREATE TABLE "otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "code" character varying NOT NULL, "type" "public"."otps_type_enum" NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "isUsed" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91fef5ed60605b854a2115d2410" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_33206384cc0a56e1d8d0a0cc47" ON "otps" ("phone") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."orders_status_enum" AS ENUM('PENDING', 'VALIDATED', 'CANCELLED', 'EXPIRED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "studentId" uuid NOT NULL, "vendorId" uuid NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'PENDING', "totalAmount" integer NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40127ba427cdb62991f5d164bd" ON "orders" ("studentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fc5a9360e2b4e795f02344ae7" ON "orders" ("vendorId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."items_status_enum" AS ENUM('ACTIVE', 'INACTIVE')`,
    );
    await queryRunner.query(
      `CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "vendorId" uuid NOT NULL, "name" character varying NOT NULL, "price" integer NOT NULL, "description" character varying, "imageUrl" character varying, "status" "public"."items_status_enum" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_80edd41a841b612ea7aac6460f" ON "items" ("vendorId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "itemId" uuid NOT NULL, "quantity" integer NOT NULL, "unitPrice" integer NOT NULL, CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('ORDER_VALIDATED', 'ORDER_CANCELLED', 'ORDER_EXPIRED', 'VENDOR_SUMMARY', 'TOPUP_SUCCESS', 'TOPUP_FAILED', 'WITHDRAWAL_SUCCESS', 'WITHDRAWAL_FAILED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying NOT NULL, "body" character varying NOT NULL, "type" "public"."notifications_type_enum" NOT NULL, "data" jsonb, "isRead" boolean NOT NULL DEFAULT false, "sentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") `,
    );
    await queryRunner.query(`TRUNCATE TABLE "users" CASCADE`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "firstName" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastName" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "phone" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "passwordHash" character varying`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_gender_enum" AS ENUM('MALE', 'FEMALE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "gender" "public"."users_gender_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "schoolId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isOnboarded" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isPhoneVerified" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "deletedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" RENAME TO "users_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('SUPER_ADMIN', 'SCHOOL_ADMIN', 'VENDOR', 'PARENT', 'STUDENT')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7d78dc7f5bcc2f72a6201bcd48" ON "users" ("phone") WHERE "deletedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_435e192698a6b7d10849295643d" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cards" ADD CONSTRAINT "FK_dac91cdbd9058c370ae94f30e9e" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_e0208b4f964e609959aff431bf9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_21d19ce21fb1f2ce83140407860" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" ADD CONSTRAINT "FK_44855579fce3690c57ae8b12999" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_441ee9c3b3bea2beb0554f7bcca" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD CONSTRAINT "FK_d9a5f2ffcbba018f7b35a3cf79f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD CONSTRAINT "FK_e54d2db793adea76aecd20186b4" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "withdrawals" ADD CONSTRAINT "FK_387a3c5d4511f738c8ca4fd4f33" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_a88f466d39796d3081cf96e1b66" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendor_wallets" ADD CONSTRAINT "FK_a711c79f1801cbb092ab4fc92d5" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" ADD CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "parents" ADD CONSTRAINT "FK_f1e08daeefd9c2e5def5746be7e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_parents" ADD CONSTRAINT "FK_d1f6a2dcc8b194ba6736723e4c3" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_parents" ADD CONSTRAINT "FK_7697f3a408af986bcb76db681c7" FOREIGN KEY ("parentId") REFERENCES "parents"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_3e7bb1ead450db031d9781a48f3" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_51f709d478293765efba498cac9" FOREIGN KEY ("initiatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_40127ba427cdb62991f5d164bd5" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_4fc5a9360e2b4e795f02344ae75" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" ADD CONSTRAINT "FK_80edd41a841b612ea7aac6460f0" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_e253fbd572683bcc785a70cbca7" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_692a909ee0fa9383e7859f9b406"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_e253fbd572683bcc785a70cbca7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "items" DROP CONSTRAINT "FK_80edd41a841b612ea7aac6460f0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_4fc5a9360e2b4e795f02344ae75"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_40127ba427cdb62991f5d164bd5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_51f709d478293765efba498cac9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "FK_3e7bb1ead450db031d9781a48f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_parents" DROP CONSTRAINT "FK_7697f3a408af986bcb76db681c7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "student_parents" DROP CONSTRAINT "FK_d1f6a2dcc8b194ba6736723e4c3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "parents" DROP CONSTRAINT "FK_f1e08daeefd9c2e5def5746be7e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_devices" DROP CONSTRAINT "FK_e12ac4f8016243ac71fd2e415af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendor_wallets" DROP CONSTRAINT "FK_a711c79f1801cbb092ab4fc92d5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_a88f466d39796d3081cf96e1b66"`,
    );
    await queryRunner.query(
      `ALTER TABLE "withdrawals" DROP CONSTRAINT "FK_387a3c5d4511f738c8ca4fd4f33"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" DROP CONSTRAINT "FK_e54d2db793adea76aecd20186b4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" DROP CONSTRAINT "FK_d9a5f2ffcbba018f7b35a3cf79f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_441ee9c3b3bea2beb0554f7bcca"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_44855579fce3690c57ae8b12999"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_21d19ce21fb1f2ce83140407860"`,
    );
    await queryRunner.query(
      `ALTER TABLE "students" DROP CONSTRAINT "FK_e0208b4f964e609959aff431bf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cards" DROP CONSTRAINT "FK_dac91cdbd9058c370ae94f30e9e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_435e192698a6b7d10849295643d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d78dc7f5bcc2f72a6201bcd48"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum_old" AS ENUM('admin', 'user')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum_old" USING "role"::"text"::"public"."users_role_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'user'`,
    );
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum_old" RENAME TO "users_role_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deletedAt"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "isPhoneVerified"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isOnboarded"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "schoolId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
    await queryRunner.query(`DROP TYPE "public"."users_gender_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "passwordHash"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "phone"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "password" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_80edd41a841b612ea7aac6460f"`,
    );
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TYPE "public"."items_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4fc5a9360e2b4e795f02344ae7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40127ba427cdb62991f5d164bd"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_33206384cc0a56e1d8d0a0cc47"`,
    );
    await queryRunner.query(`DROP TABLE "otps"`);
    await queryRunner.query(`DROP TYPE "public"."otps_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c031085d1b344bad770be917a"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3e7bb1ead450db031d9781a48f"`,
    );
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payments_currency_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_c25bc63d248ca90e8dcc1d92d0"`,
    );
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "student_parents"`);
    await queryRunner.query(`DROP TABLE "parents"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e81c41e04269a2d2152f0d60b5"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_16f140c105284aa358150582ce"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e12ac4f8016243ac71fd2e415a"`,
    );
    await queryRunner.query(`DROP TABLE "user_devices"`);
    await queryRunner.query(`DROP TYPE "public"."user_devices_platform_enum"`);
    await queryRunner.query(`DROP TABLE "vendor_wallets"`);
    await queryRunner.query(
      `DROP TYPE "public"."vendor_wallets_currency_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a88f466d39796d3081cf96e1b6"`,
    );
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_currency_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_387a3c5d4511f738c8ca4fd4f3"`,
    );
    await queryRunner.query(`DROP TABLE "withdrawals"`);
    await queryRunner.query(`DROP TYPE "public"."withdrawals_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."withdrawals_currency_enum"`);
    await queryRunner.query(`DROP TABLE "vendors"`);
    await queryRunner.query(`DROP TYPE "public"."vendors_status_enum"`);
    await queryRunner.query(`DROP TABLE "wallets"`);
    await queryRunner.query(`DROP TYPE "public"."wallets_currency_enum"`);
    await queryRunner.query(`DROP TABLE "students"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_af8c1e25df58bc35de84c8e54e"`,
    );
    await queryRunner.query(`DROP TABLE "cards"`);
    await queryRunner.query(`DROP TYPE "public"."cards_status_enum"`);
  }
}
