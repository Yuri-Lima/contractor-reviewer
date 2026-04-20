import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4 of the legal-grade RAG pipeline: persistent drafting reviews.
 *
 * Stores one row per (documentId, rulesVersion, llmModel) combination so
 * - re-running with the same rules + model is a no-op (idempotency)
 * - bumping rules or model produces a fresh row (history/auditability)
 *
 * `down()` is reversible.
 */
export class AddDocumentReview1787200000000 implements MigrationInterface {
  name = 'AddDocumentReview1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_reviews" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "rulesVersion" varchar(32) NOT NULL,
        "llmModel" varchar(128) NULL,
        "issues" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "compliantElements" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "recommendations" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "legislationReferenced" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "issueCounts" jsonb NOT NULL DEFAULT '{"blocker":0,"high":0,"medium":0,"low":0,"info":0}'::jsonb,
        "durationMs" int NULL,
        "status" varchar(16) NOT NULL DEFAULT 'succeeded',
        "errorMessage" text NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_document_review_document"
          FOREIGN KEY ("documentId") REFERENCES "documents" ("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_document_review_doc_rules_model"
        ON "document_reviews" ("documentId", "rulesVersion", COALESCE("llmModel", ''));
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_document_review_doc" ON "document_reviews" ("documentId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_document_review_doc"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_document_review_doc_rules_model"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_reviews"`);
  }
}
