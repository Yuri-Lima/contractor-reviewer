import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoiceTranscribeAndParserApiKeyToAuditAction1771500000000
  implements MigrationInterface
{
  name = 'AddVoiceTranscribeAndParserApiKeyToAuditAction1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'voice_transcribe'
    `);
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'parser_api_key_update'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // A full recreate would be required; leaving as no-op for safety.
  }
}
