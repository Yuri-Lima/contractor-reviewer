import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4: register the audit action emitted whenever a document review is
 * generated (post-OCR auto-trigger or operator-initiated rerun).
 *
 * Also adds the `jurisdiction_override` value defensively — the application
 * code references it but no prior migration registered it on the enum, so a
 * fresh DB built from migrations would otherwise reject inserts using that
 * value.
 */
export class AddDocumentReviewAuditAction1787210000000 implements MigrationInterface {
  name = 'AddDocumentReviewAuditAction1787210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'jurisdiction_override'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'document_review_generated'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating
    // the type. Leaving as a no-op for safety.
  }
}
