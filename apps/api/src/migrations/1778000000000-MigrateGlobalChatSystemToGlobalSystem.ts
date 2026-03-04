import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migrate existing global chat.system prompt to global.system.
 * Idempotent: skips if global.system already exists.
 */
export class MigrateGlobalChatSystemToGlobalSystem1778000000000
  implements MigrationInterface
{
  name = 'MigrateGlobalChatSystemToGlobalSystem1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT id FROM "prompts" WHERE "key" = 'global.system' AND "workspaceId" IS NULL AND "documentId" IS NULL LIMIT 1`,
    );
    if (existing.length > 0) {
      return; // Already migrated
    }

    const legacy = await queryRunner.query(
      `SELECT "content", "metadata" FROM "prompts" WHERE "key" = 'chat.system' AND "workspaceId" IS NULL AND "documentId" IS NULL LIMIT 1`,
    );

    const content =
      legacy.length > 0
        ? legacy[0].content
        : 'You are a legal assistant. Provide accurate, evidence-based answers. Always cite your sources. When a language is specified, provide all answers in that language.';
    const metadata = legacy.length > 0 ? legacy[0].metadata : null;

    await queryRunner.query(
      `INSERT INTO "prompts" ("key", "variant", "content", "metadata", "workspaceId", "documentId") VALUES ('global.system', 'default', $1, $2, NULL, NULL)`,
      [content, metadata ? JSON.stringify(metadata) : null],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "prompts" WHERE "key" = 'global.system' AND "workspaceId" IS NULL AND "documentId" IS NULL`,
    );
  }
}
