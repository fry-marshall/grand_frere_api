import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOpeningHoursToVendors1777600000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD COLUMN "openingTime" varchar NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "vendors" ADD COLUMN "closingTime" varchar NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "openingTime"`);
    await queryRunner.query(`ALTER TABLE "vendors" DROP COLUMN "closingTime"`);
  }
}
