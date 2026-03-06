import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultLlmProvider1780000000000 implements MigrationInterface {
  name = 'AddDefaultLlmProvider1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_settings" ADD COLUMN IF NOT EXISTS "defaultLlmProvider" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workspace_settings" DROP COLUMN IF EXISTS "defaultLlmProvider"`,
    );
  }
}
