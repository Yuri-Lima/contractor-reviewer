import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChunkingStrategy1770500000000 implements MigrationInterface {
  name = 'AddChunkingStrategy1770500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings" 
      ADD COLUMN IF NOT EXISTS "chunkingStrategy" character varying NOT NULL DEFAULT 'paragraph'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "workspace_settings" 
      DROP COLUMN IF EXISTS "chunkingStrategy"
    `);
  }
}
