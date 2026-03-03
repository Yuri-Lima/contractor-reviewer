import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDocumentIdToPrompts1774000000000 implements MigrationInterface {
  name = 'AddDocumentIdToPrompts1774000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add documentId column
    await queryRunner.query(`
      ALTER TABLE "prompts"
      ADD COLUMN "documentId" uuid
    `);

    // Add FK with cascade delete
    await queryRunner.query(`
      ALTER TABLE "prompts"
      ADD CONSTRAINT "FK_prompts_documentId"
      FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    // Drop old unique constraints
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prompts_global"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prompts_workspace"`);

    // Create new unique constraints with documentId support
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_global"
      ON "prompts" ("key", "variant")
      WHERE "workspaceId" IS NULL AND "documentId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_workspace"
      ON "prompts" ("key", "variant", "workspaceId")
      WHERE "workspaceId" IS NOT NULL AND "documentId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_document"
      ON "prompts" ("key", "variant", "documentId")
      WHERE "documentId" IS NOT NULL
    `);

    // Add index for document-scoped lookups
    await queryRunner.query(`
      CREATE INDEX "IDX_prompts_documentId" ON "prompts" ("documentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_prompts_documentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prompts_document"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prompts_workspace"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_prompts_global"`);

    await queryRunner.query(`
      ALTER TABLE "prompts"
      DROP CONSTRAINT IF EXISTS "FK_prompts_documentId"
    `);
    await queryRunner.query(`
      ALTER TABLE "prompts"
      DROP COLUMN IF EXISTS "documentId"
    `);

    // Restore original unique constraints
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_global"
      ON "prompts" ("key", "variant")
      WHERE "workspaceId" IS NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_prompts_workspace"
      ON "prompts" ("key", "variant", "workspaceId")
      WHERE "workspaceId" IS NOT NULL
    `);
  }
}
