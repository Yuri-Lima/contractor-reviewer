import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPreferredTranscriptionProvider1771200000000 implements MigrationInterface {
  name = 'AddUserPreferredTranscriptionProvider1771200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "preferredTranscriptionProvider" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "preferredTranscriptionProvider"`,
    );
  }
}
