import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDescriptionAndLogoToSchools20260815000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" ADD "description" text`);
    await queryRunner.query(
      `ALTER TABLE "schools" ADD "logoUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "logoUrl"`);
    await queryRunner.query(`ALTER TABLE "schools" DROP COLUMN "description"`);
  }
}
