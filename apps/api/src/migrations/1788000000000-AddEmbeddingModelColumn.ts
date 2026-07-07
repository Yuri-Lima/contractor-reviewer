import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Record which embedding model produced each vector so RAG search can filter
 * out incompatible rows when OPENAI_EMBEDDING_MODEL changes.
 *
 * Do not run this migration as part of the bugfix verification loop —
 * it is committed for operators to apply via the normal migration path.
 */
export class AddEmbeddingModelColumn1788000000000 implements MigrationInterface {
  name = 'AddEmbeddingModelColumn1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "embeddingModel" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "embeddingModel" character varying(128)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_embeddings_embeddingModel" ON "embeddings" ("embeddingModel")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_chunks_embeddingModel" ON "chunks" ("embeddingModel")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chunks_embeddingModel"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_embeddings_embeddingModel"`);
    await queryRunner.query(
      `ALTER TABLE "chunks" DROP COLUMN IF EXISTS "embeddingModel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "embeddings" DROP COLUMN IF EXISTS "embeddingModel"`,
    );
  }
}
