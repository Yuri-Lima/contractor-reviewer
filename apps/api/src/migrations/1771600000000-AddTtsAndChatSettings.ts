import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTtsAndChatSettings1771600000000 implements MigrationInterface {
  name = 'AddTtsAndChatSettings1771600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "ttsProviderApiKeys" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "preferredTtsProvider" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "chatResponseMode" varchar DEFAULT 'text_only'
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "voiceAutoSend" boolean DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'tts_synthesize'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "ttsProviderApiKeys"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "preferredTtsProvider"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "chatResponseMode"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "voiceAutoSend"
    `);
    // PostgreSQL does not support removing enum values
  }
}
