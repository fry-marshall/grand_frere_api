import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLostToCardStatus20260803000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "cards_status_enum" ADD VALUE IF NOT EXISTS 'LOST'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing an enum value directly.
    // A full enum recreation is required; handled manually if needed.
  }
}
