import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingImageUrlToItems20260803010000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" ADD "pendingImageUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "items" DROP COLUMN "pendingImageUrl"`,
    );
  }
}
