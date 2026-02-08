import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFuzzyMatchThreshold1700000003000 implements MigrationInterface {
  name = 'AddFuzzyMatchThreshold1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add fuzzyMatchThreshold column to workspace_settings
    await queryRunner.query(`
      ALTER TABLE "workspace_settings" 
      ADD COLUMN IF NOT EXISTS "fuzzyMatchThreshold" integer NOT NULL DEFAULT 70
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove fuzzyMatchThreshold column
    await queryRunner.query(`
      ALTER TABLE "workspace_settings" 
      DROP COLUMN IF EXISTS "fuzzyMatchThreshold"
    `);
  }
}
