import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudentCanEditDailyLimitToCards20260721120000 implements MigrationInterface {
  name = 'AddStudentCanEditDailyLimitToCards20260721120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cards" ADD "studentCanEditDailyLimit" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cards" DROP COLUMN "studentCanEditDailyLimit"`,
    );
  }
}
