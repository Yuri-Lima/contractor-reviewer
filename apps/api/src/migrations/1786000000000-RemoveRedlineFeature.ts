import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the redline + document-versions feature from the database:
 *   1. Drops `document_versions` table (and its enum + FK constraints).
 *   2. Deletes any prompt rows associated with redline keys.
 *   3. Recreates `audit_logs.action` enum without `redline_generate` / `redline_apply`.
 *   4. Recreates `audit_logs.targetType` enum without `version`.
 *
 * This migration is one-way (irreversible). Down is intentionally a no-op
 * that throws to avoid silently producing a broken / partial schema.
 */
export class RemoveRedlineFeature1786000000000 implements MigrationInterface {
  name = 'RemoveRedlineFeature1786000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop document_versions table (and dependent objects like its enum + FKs)
    //    Use CASCADE so any leftover constraints are removed regardless of order.
    await queryRunner.query(`DROP TABLE IF EXISTS "document_versions" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."document_versions_playbook_enum"`);

    // 2. Delete redline-related prompt rows (system, user, playbooks)
    await queryRunner.query(`DELETE FROM "prompts" WHERE "key" LIKE 'redline.%'`);

    // 3. Recreate audit_logs.action enum without redline values.
    //    PostgreSQL doesn't support removing values from an enum, so we
    //    create a new enum, swap the column, and drop the old one.
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_action_enum_new" AS ENUM(` +
        `'open_view', 'download', 'chat_query', 'delete', 'export_privacy', ` +
        `'upload', 'member_add', 'member_remove', 'settings_update', ` +
        `'voice_transcribe', 'parser_api_key_update', 'tts_synthesize', ` +
        `'prompt_generate'` +
        `)`,
    );
    // Remove any historical rows that used redline_* actions, otherwise the
    // USING cast below will fail because those values are not in the new enum.
    await queryRunner.query(
      `DELETE FROM "audit_logs" WHERE "action"::text IN ('redline_generate', 'redline_apply')`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_logs_action_enum_new" ` +
        `USING "action"::text::"public"."audit_logs_action_enum_new"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_action_enum_new" RENAME TO "audit_logs_action_enum"`,
    );

    // 4. Recreate audit_logs.targetType enum without 'version'.
    await queryRunner.query(
      `CREATE TYPE "public"."audit_logs_targettype_enum_new" AS ENUM(` +
        `'document', 'file', 'workspace', 'user', 'chat'` +
        `)`,
    );
    await queryRunner.query(
      `DELETE FROM "audit_logs" WHERE "targetType"::text = 'version'`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_logs" ALTER COLUMN "targetType" TYPE "public"."audit_logs_targettype_enum_new" ` +
        `USING "targetType"::text::"public"."audit_logs_targettype_enum_new"`,
    );
    await queryRunner.query(`DROP TYPE "public"."audit_logs_targettype_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."audit_logs_targettype_enum_new" RENAME TO "audit_logs_targettype_enum"`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Irreversible migration: redline feature and document_versions table have been removed. ' +
        'Restore from a database backup if you need to recover this data.',
    );
  }
}
