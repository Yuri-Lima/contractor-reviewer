import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkspacePreferredTranscriptionProvider1771400000000
  implements MigrationInterface
{
  name = 'AddWorkspacePreferredTranscriptionProvider1771400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN IF NOT EXISTS "preferredTranscriptionProvider" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN IF EXISTS "preferredTranscriptionProvider"
    `);
  }
}
