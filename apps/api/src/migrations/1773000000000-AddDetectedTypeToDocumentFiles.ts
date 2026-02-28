import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add content-based detected file type to document_files.
 * Enables frontend to route to correct viewer (e.g. renamed .xyz that is actually PDF).
 */
export class AddDetectedTypeToDocumentFiles1773000000000 implements MigrationInterface {
  name = 'AddDetectedTypeToDocumentFiles1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "document_files" ADD COLUMN IF NOT EXISTS "detectedExt" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "document_files" ADD COLUMN IF NOT EXISTS "detectedMime" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN IF EXISTS "detectedExt"`);
    await queryRunner.query(`ALTER TABLE "document_files" DROP COLUMN IF EXISTS "detectedMime"`);
  }
}
