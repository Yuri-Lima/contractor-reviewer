import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRedlineFields1700000002000 implements MigrationInterface {
  name = 'AddRedlineFields1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add decisions column to document_versions
    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      ADD COLUMN "decisions" jsonb
    `);

    // Add parentVersionId column to document_versions
    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      ADD COLUMN "parentVersionId" uuid
    `);

    // Add foreign key constraint for parentVersionId
    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      ADD CONSTRAINT "FK_document_versions_parentVersionId" 
      FOREIGN KEY ("parentVersionId") 
      REFERENCES "document_versions"("id") 
      ON DELETE SET NULL 
      ON UPDATE NO ACTION
    `);

    // Add REDLINE_APPLY to audit_logs action enum
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum" 
      ADD VALUE IF NOT EXISTS 'redline_apply'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      DROP CONSTRAINT IF EXISTS "FK_document_versions_parentVersionId"
    `);

    // Remove columns
    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      DROP COLUMN IF EXISTS "parentVersionId"
    `);

    await queryRunner.query(`
      ALTER TABLE "document_versions" 
      DROP COLUMN IF EXISTS "decisions"
    `);

    // Note: Cannot remove enum value in PostgreSQL, so we leave it
    // The enum value 'redline_apply' will remain but won't be used
  }
}
