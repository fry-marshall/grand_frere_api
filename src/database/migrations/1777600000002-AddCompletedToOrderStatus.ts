import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompletedToOrderStatus1777600000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "orders_status_enum" ADD VALUE IF NOT EXISTS 'COMPLETED'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing an enum value directly.
    // A full enum recreation is required; handled manually if needed.
  }
}
