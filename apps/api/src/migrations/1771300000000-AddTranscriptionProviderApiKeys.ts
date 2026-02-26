import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTranscriptionProviderApiKeys1771300000000 implements MigrationInterface {
  name = 'AddTranscriptionProviderApiKeys1771300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "transcriptionProviderApiKeys" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "transcriptionProviderApiKeys"
    `);
  }
}
