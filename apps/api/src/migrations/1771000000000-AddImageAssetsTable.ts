import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageAssetsTable1771000000000 implements MigrationInterface {
  name = 'AddImageAssetsTable1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "image_assets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "context" character varying(50) NOT NULL,
        "ownerId" character varying NOT NULL,
        "storageKey" character varying NOT NULL,
        "variantKeys" jsonb,
        "mimeType" character varying NOT NULL,
        "width" integer,
        "height" integer,
        "sizeBytes" bigint NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_image_assets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_image_assets_context_ownerId" ON "image_assets" ("context", "ownerId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_image_assets_context_ownerId"`);
    await queryRunner.query(`DROP TABLE "image_assets"`);
  }
}
