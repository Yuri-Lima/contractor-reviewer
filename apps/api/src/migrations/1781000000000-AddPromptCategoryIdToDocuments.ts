import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptCategoryIdToDocuments1781000000000 implements MigrationInterface {
  name = 'AddPromptCategoryIdToDocuments1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "promptCategoryId" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "promptCategoryId"`,
    );
  }
}
