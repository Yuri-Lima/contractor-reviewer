import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChatThreadTargetType1787220000000 implements MigrationInterface {
  name = 'AddChatThreadTargetType1787220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "public"."audit_logs_targettype_enum"
      ADD VALUE IF NOT EXISTS 'chat_thread'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values without recreating
    // the type. Leaving as a no-op for safety.
  }
}
