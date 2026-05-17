import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToOrders1747440000000 implements MigrationInterface {
  name = 'AddPaymentMethodToOrders1747440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."orders_paymentmethod_enum" AS ENUM('WALLET', 'CASH')`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD "paymentMethod" "public"."orders_paymentmethod_enum" NOT NULL DEFAULT 'WALLET'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "paymentMethod"`);
    await queryRunner.query(`DROP TYPE "public"."orders_paymentmethod_enum"`);
  }
}
