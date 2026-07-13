import { MigrationInterface, QueryRunner } from 'typeorm';

// vendors.photoUrl used to store the full Spaces URL
// (https://{bucket}.{region}.digitaloceanspaces.com/vendors/{id}/{filename}).
// VendorsService now stores only the filename and reconstructs the public
// URL on read via IStorageService.getPublicUrl.
export class BackfillVendorPhotoFilenames20260713020000 implements MigrationInterface {
  name = 'BackfillVendorPhotoFilenames20260713020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "vendors" SET "photoUrl" = substring("photoUrl" from '[^/]+$') WHERE "photoUrl" LIKE 'http%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const bucket = process.env.DO_SPACES_BUCKET;
    const region = process.env.DO_SPACES_REGION;
    if (!bucket || !region) {
      throw new Error(
        'DO_SPACES_BUCKET and DO_SPACES_REGION must be set to revert this migration',
      );
    }

    await queryRunner.query(
      `UPDATE "vendors" SET "photoUrl" = 'https://${bucket}.${region}.digitaloceanspaces.com/vendors/' || "id" || '/' || "photoUrl" WHERE "photoUrl" IS NOT NULL AND "photoUrl" NOT LIKE 'http%'`,
    );
  }
}
