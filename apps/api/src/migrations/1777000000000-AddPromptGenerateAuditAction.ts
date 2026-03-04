import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptGenerateAuditAction1777000000000
  implements MigrationInterface
{
  name = 'AddPromptGenerateAuditAction1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_action_enum"
      ADD VALUE IF NOT EXISTS 'prompt_generate'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from enums.
    // A full recreate would be required; leaving as no-op for safety.
  }
}
