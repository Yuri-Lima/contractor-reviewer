import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTtsProviderConfig1771700000000 implements MigrationInterface {
  name = 'AddTtsProviderConfig1771700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "ttsProviderConfig" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "ttsProviderConfig"
    `);
  }
}
