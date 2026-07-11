import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderReceivedToNotificationType20260711000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'ORDER_RECEIVED'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing an enum value directly.
    // A full enum recreation is required; handled manually if needed.
  }
}
