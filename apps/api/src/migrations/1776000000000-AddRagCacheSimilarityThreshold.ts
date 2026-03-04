import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRagCacheSimilarityThreshold1776000000000 implements MigrationInterface {
  name = 'AddRagCacheSimilarityThreshold1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "ragCacheSimilarityThreshold" decimal(3,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "ragCacheSimilarityThreshold"`,
    );
  }
}
