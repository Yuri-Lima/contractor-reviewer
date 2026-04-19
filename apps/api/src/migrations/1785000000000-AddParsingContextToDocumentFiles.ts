import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add parsing context (JSONB) to document_files.
 * Stores parser metadata (parserId, parserVersion, usedOcr, etc.) for frontend display.
 */
export class AddParsingContextToDocumentFiles1785000000000 implements MigrationInterface {
  name = 'AddParsingContextToDocumentFiles1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_files" ADD COLUMN IF NOT EXISTS "parsingContext" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_files" DROP COLUMN IF EXISTS "parsingContext"`,
    );
  }
}
