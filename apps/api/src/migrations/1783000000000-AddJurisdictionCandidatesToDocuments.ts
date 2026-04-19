import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJurisdictionCandidatesToDocuments1783000000000
  implements MigrationInterface
{
  name = 'AddJurisdictionCandidatesToDocuments1783000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "jurisdictionCandidates" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "jurisdictionReasoning" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "jurisdictionCandidates"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP COLUMN IF EXISTS "jurisdictionReasoning"`,
    );
  }
}
