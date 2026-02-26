import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStorageSettingsTable1771100000000 implements MigrationInterface {
  name = 'AddUserStorageSettingsTable1771100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_storage_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "configEncrypted" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_storage_settings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_storage_settings_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_storage_settings_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_storage_settings"`);
  }
}
