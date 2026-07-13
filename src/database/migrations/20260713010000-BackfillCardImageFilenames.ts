import { MigrationInterface, QueryRunner } from 'typeorm';

// cards.imageUrl used to store the full Spaces URL
// (https://{bucket}.{region}.digitaloceanspaces.com/cards/{schoolId}/{code}.png).
// CardsService now stores only the filename (e.g. "GF-LGB-9602.png") and
// reconstructs the full URL on read via IStorageService.getPublicUrl.
export class BackfillCardImageFilenames20260713010000 implements MigrationInterface {
  name = 'BackfillCardImageFilenames20260713010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "cards" SET "imageUrl" = substring("imageUrl" from '[^/]+$') WHERE "imageUrl" LIKE 'http%'`,
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
      `UPDATE "cards" SET "imageUrl" = 'https://${bucket}.${region}.digitaloceanspaces.com/cards/' || "schoolId" || '/' || "imageUrl" WHERE "imageUrl" IS NOT NULL AND "imageUrl" NOT LIKE 'http%'`,
    );
  }
}
