import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCardBatches20260809000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."card_batches_template_enum" AS ENUM('DROGBA', 'LUFFY', 'NARUTO', 'ZORO')`,
    );
    await queryRunner.query(
      `CREATE TABLE "card_batches" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "schoolId" uuid NOT NULL, "template" "public"."card_batches_template_enum" NOT NULL, "count" integer NOT NULL, "pdfUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_card_batches_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "card_batches" ADD CONSTRAINT "FK_card_batches_schoolId" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "card_batches" DROP CONSTRAINT "FK_card_batches_schoolId"`,
    );
    await queryRunner.query(`DROP TABLE "card_batches"`);
    await queryRunner.query(`DROP TYPE "public"."card_batches_template_enum"`);
  }
}
