import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pg_trgm extension for fuzzy/trigram similarity search.
 * Creates GIN index on document_files.fileName for fast trigram search.
 */
export class AddPgTrgm1771800000000 implements MigrationInterface {
  name = 'AddPgTrgm1771800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_document_files_file_name_gin" ON "document_files" USING GIN ("fileName" gin_trgm_ops);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_document_files_file_name_gin";`);
  }
}
