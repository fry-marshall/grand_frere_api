import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFcmTokenToUsers1777587730897 implements MigrationInterface {
  name = 'AddFcmTokenToUsers1777587730897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "fcmToken" character varying`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum" RENAME TO "notifications_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('ORDER_VALIDATED', 'ORDER_CANCELLED', 'ORDER_EXPIRED', 'VENDOR_SUMMARY', 'VENDOR_APPROVED', 'VENDOR_REJECTED', 'TOPUP_SUCCESS', 'TOPUP_FAILED', 'WITHDRAWAL_SUCCESS', 'WITHDRAWAL_FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum" USING "type"::"text"::"public"."notifications_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum_old" AS ENUM('ORDER_VALIDATED', 'ORDER_CANCELLED', 'ORDER_EXPIRED', 'VENDOR_SUMMARY', 'TOPUP_SUCCESS', 'TOPUP_FAILED', 'WITHDRAWAL_SUCCESS', 'WITHDRAWAL_FAILED')`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "public"."notifications_type_enum_old" USING "type"::"text"::"public"."notifications_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."notifications_type_enum_old" RENAME TO "notifications_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcmToken"`);
  }
}
