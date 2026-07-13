import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateSchoolJoinRequests20260713140000 implements MigrationInterface {
  name = 'UpdateSchoolJoinRequests20260713140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "sigle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "address"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "contactFirstName" TO "firstName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "contactLastName" TO "lastName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "contactPhone" TO "phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "city" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "studentCount" integer NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."school_join_requests_gender_enum" AS ENUM('MALE', 'FEMALE')`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "gender" "public"."school_join_requests_gender_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "email" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "position" character varying NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "position"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "email"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "gender"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."school_join_requests_gender_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "studentCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" DROP COLUMN "city"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "phone" TO "contactPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "lastName" TO "contactLastName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" RENAME COLUMN "firstName" TO "contactFirstName"`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "address" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "school_join_requests" ADD "sigle" character varying NOT NULL`,
    );
  }
}
