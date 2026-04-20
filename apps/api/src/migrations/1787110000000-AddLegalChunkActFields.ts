import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3 of the legal-grade RAG pipeline: denormalize per-act metadata onto
 * the `embeddings` (legal-source chunks) table so the seed-legal-corpus script
 * can populate it from the authoring YAML and the rag service can apply a
 * +0.1 reranking bonus when a document chunk mentions a candidate `actName`
 * without doing a JOIN on the hot path.
 *
 * `down()` is reversible. The columns are nullable so the migration is safe
 * to run on a populated DB; the seed script will backfill in a follow-up.
 */
export class AddLegalChunkActFields1787110000000 implements MigrationInterface {
  name = 'AddLegalChunkActFields1787110000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "actName" varchar(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "actYear" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "lastVerified" date`,
    );
    // Composite index supports the `searchLegalChunks` filter path (already
    // filters by country/jurisdiction); adding actName lets us scope to a
    // single act when the rerank step nominates one.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_embeddings_act_name" ON "embeddings" ("actName") WHERE "actName" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_embeddings_act_name"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "lastVerified"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "actYear"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "actName"`);
  }
}
