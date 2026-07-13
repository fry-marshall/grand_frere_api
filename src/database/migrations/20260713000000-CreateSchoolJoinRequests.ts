import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchoolJoinRequests20260713000000 implements MigrationInterface {
  name = 'CreateSchoolJoinRequests20260713000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."school_join_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`,
    );
    await queryRunner.query(
      `CREATE TABLE "school_join_requests" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "schoolName" character varying NOT NULL, "sigle" character varying NOT NULL, "address" character varying NOT NULL, "contactFirstName" character varying NOT NULL, "contactLastName" character varying NOT NULL, "contactPhone" character varying NOT NULL, "message" text, "status" "public"."school_join_requests_status_enum" NOT NULL DEFAULT 'PENDING', "rejectionReason" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_school_join_requests_id" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "school_join_requests"`);
    await queryRunner.query(
      `DROP TYPE "public"."school_join_requests_status_enum"`,
    );
  }
}
