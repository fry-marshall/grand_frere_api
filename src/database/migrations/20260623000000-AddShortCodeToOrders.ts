import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShortCodeToOrders20260623000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shortCode" CHAR(4) NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_orders_vendor_scheduled_shortcode"
       ON "orders" ("vendorId", "scheduledFor", "shortCode")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_orders_vendor_scheduled_shortcode"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP COLUMN IF EXISTS "shortCode"`,
    );
  }
}
