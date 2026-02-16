import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVisitedRoutes1770900000000 implements MigrationInterface {
  name = 'AddVisitedRoutes1770900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_onboarding_state" ADD COLUMN "visitedRoutes" jsonb NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_onboarding_state" DROP COLUMN "visitedRoutes"
    `);
  }
}
