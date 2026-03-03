import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptScopeToggles1775000000000 implements MigrationInterface {
  name = 'AddPromptScopeToggles1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN "promptScopeIncludeGlobal" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD COLUMN "promptScopeIncludeWorkspace" boolean NOT NULL DEFAULT true
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD COLUMN "promptScopeIncludeDocument" boolean NOT NULL DEFAULT true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN "promptScopeIncludeGlobal"
    `);
    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      DROP COLUMN "promptScopeIncludeWorkspace"
    `);
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP COLUMN "promptScopeIncludeDocument"
    `);
  }
}
