import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentParserSupport1770700000000 implements MigrationInterface {
  name = 'AddDocumentParserSupport1770700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "defaultDocumentParser" character varying NOT NULL DEFAULT 'docling'
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "parserApiKeys" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "document_files"
      ADD COLUMN IF NOT EXISTS "parsedBy" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "defaultDocumentParser"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "parserApiKeys"
    `);
    await queryRunner.query(`
      ALTER TABLE "document_files"
      DROP COLUMN IF EXISTS "parsedBy"
    `);
  }
}
