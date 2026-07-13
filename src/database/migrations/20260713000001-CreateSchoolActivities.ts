import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolActivities20260713000001 implements MigrationInterface {
  name = 'CreateSchoolActivities20260713000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "school_activities" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "schoolId" uuid NOT NULL, "title" character varying NOT NULL, "description" text NOT NULL, "photoUrls" text, "isVisible" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_school_activities_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_school_activities_schoolId" ON "school_activities" ("schoolId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_activities" ADD CONSTRAINT "FK_school_activities_schoolId" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "school_activities" DROP CONSTRAINT "FK_school_activities_schoolId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_school_activities_schoolId"`,
    );
    await queryRunner.query(`DROP TABLE "school_activities"`);
  }
}
