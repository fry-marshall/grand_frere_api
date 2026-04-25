import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailyLimitToCards1777127302558 implements MigrationInterface {
  name = 'AddDailyLimitToCards1777127302558';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cards" ADD "dailyLimit" integer NOT NULL DEFAULT '1000'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "cards" DROP COLUMN "dailyLimit"`);
  }
}
