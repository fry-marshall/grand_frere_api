import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderIdToNotifications20260711120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "orderId" character varying NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notifications_orderId" ON "notifications" ("orderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notifications_orderId"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP COLUMN IF EXISTS "orderId"`,
    );
  }
}
