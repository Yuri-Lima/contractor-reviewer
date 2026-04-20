import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds clause-level metadata to the `chunks` table for the legal-grade
 * RAG pipeline (Phase 2). The chunker (services/docling/app.py) populates
 * these on ingest; existing rows stay null until re-indexed via the new
 * admin endpoint `POST /admin/documents/:id/reindex`.
 *
 *   - `clauseNumber`  — short numeric clause id (e.g. "9.1.3")
 *   - `headingPath`   — jsonb array of breadcrumbs for the section
 *
 * `down()` is reversible: drops both columns. Safe in dev because the
 * data they hold is derivable from the source document on re-ingest.
 */
export class AddClauseFieldsToChunks1787100000000 implements MigrationInterface {
  name = 'AddClauseFieldsToChunks1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "clauseNumber" varchar(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "headingPath" jsonb`,
    );
    // Partial b-tree index on clauseNumber to speed "show me all chunks
    // for clause 9.1.x" lookups when the new admin reindex endpoint or
    // the LegalAnswerComponent jump-to-clause dispatcher resolves a ref.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_chunks_clause_number" ON "chunks" ("clauseNumber") WHERE "clauseNumber" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_chunks_clause_number"`);
    await queryRunner.query(`ALTER TABLE "chunks" DROP COLUMN IF EXISTS "headingPath"`);
    await queryRunner.query(`ALTER TABLE "chunks" DROP COLUMN IF EXISTS "clauseNumber"`);
  }
}
