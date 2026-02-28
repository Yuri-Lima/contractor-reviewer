import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Denormalize legal_sources metadata into embeddings table.
 * Enables vector search without JOIN when embedding tables move to separate DB.
 */
export class AddLegalMetadataToEmbeddings1772000000000 implements MigrationInterface {
  name = 'AddLegalMetadataToEmbeddings1772000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add denormalized columns
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "sourceName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "country" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "jurisdiction" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "url" character varying`,
    );

    // Backfill from legal_sources
    await queryRunner.query(`
      UPDATE "embeddings" e
      SET
        "sourceName" = ls."sourceName",
        "country" = ls."country",
        "jurisdiction" = ls."jurisdiction",
        "url" = ls."url"
      FROM "legal_sources" ls
      WHERE e."legalSourceId" = ls.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "sourceName"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "country"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "jurisdiction"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "url"`);
  }
}
