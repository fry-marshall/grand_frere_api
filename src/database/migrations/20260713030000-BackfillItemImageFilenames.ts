import { MigrationInterface, QueryRunner } from 'typeorm';

// items.imageUrl mixes two kinds of values: real Spaces URLs from uploaded
// photos (https://{bucket}.{region}.digitaloceanspaces.com/items/{id}/{filename})
// and external placeholder URLs from seed data (e.g. https://picsum.photos/...).
// Only the former belongs to our own storage — ItemsService now stores just
// the filename for those and reconstructs the public URL on read via
// IStorageService.getPublicUrl, while leaving any other URL (imageUrl already
// starting with "http") untouched and served as-is.
export class BackfillItemImageFilenames20260713030000 implements MigrationInterface {
  name = 'BackfillItemImageFilenames20260713030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "items" SET "imageUrl" = substring("imageUrl" from '[^/]+$') WHERE "imageUrl" LIKE '%digitaloceanspaces.com/items/%'`,
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

    // Only reconstruct rows that hold a bare filename (no "/"), matching
    // exactly what `up()` produced — external URLs (picsum, ...) are left as-is.
    await queryRunner.query(
      `UPDATE "items" SET "imageUrl" = 'https://${bucket}.${region}.digitaloceanspaces.com/items/' || "id" || '/' || "imageUrl" WHERE "imageUrl" IS NOT NULL AND "imageUrl" NOT LIKE '%/%'`,
    );
  }
}
