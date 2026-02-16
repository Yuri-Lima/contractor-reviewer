import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserOnboardingState1770800000000 implements MigrationInterface {
  name = 'AddUserOnboardingState1770800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_onboarding_state" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "onboardingVersion" integer NOT NULL DEFAULT 1,
        "completed" boolean NOT NULL DEFAULT false,
        "dismissed" boolean NOT NULL DEFAULT false,
        "checklist" jsonb NOT NULL DEFAULT '{}',
        "tour" jsonb NOT NULL DEFAULT '{}',
        "lastResetAt" TIMESTAMP WITH TIME ZONE,
        "resetCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_onboarding_state_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_user_onboarding_state_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_onboarding_state"`);
  }
}
