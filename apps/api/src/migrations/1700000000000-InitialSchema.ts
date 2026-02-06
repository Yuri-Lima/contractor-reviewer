import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "name" character varying,
        "role" character varying NOT NULL DEFAULT 'user',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);

    // Create workspaces table
    await queryRunner.query(`
      CREATE TABLE "workspaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_workspaces" PRIMARY KEY ("id")
      )
    `);

    // Create workspace_members table
    await queryRunner.query(`
      CREATE TABLE "workspace_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" character varying NOT NULL DEFAULT 'MEMBER',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_workspace_members_workspaceId_userId" UNIQUE ("workspaceId", "userId"),
        CONSTRAINT "PK_workspace_members" PRIMARY KEY ("id")
      )
    `);

    // Create documents table
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text,
        "status" character varying NOT NULL DEFAULT 'processing',
        "resolvedJurisdiction" character varying,
        "jurisdictionStatus" character varying,
        "detectedLanguage" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("id")
      )
    `);

    // Create document_files table
    await queryRunner.query(`
      CREATE TABLE "document_files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "fileName" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "sizeBytes" bigint NOT NULL,
        "storageKey" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'uploading',
        "errorMessage" character varying,
        "ocrText" text,
        "pageCount" integer,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_files" PRIMARY KEY ("id")
      )
    `);

    // Create chunks table (with pgvector)
    await queryRunner.query(`
      CREATE TABLE "chunks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "pageNumber" integer,
        "paragraphId" character varying,
        "text" text NOT NULL,
        "startIndex" integer NOT NULL DEFAULT 0,
        "endIndex" integer NOT NULL DEFAULT 0,
        "embedding" vector(1536),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chunks" PRIMARY KEY ("id")
      )
    `);

    // Create legal_sources table
    await queryRunner.query(`
      CREATE TABLE "legal_sources" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "country" character varying NOT NULL,
        "jurisdiction" character varying,
        "sourceType" character varying NOT NULL,
        "sourceName" character varying NOT NULL,
        "section" character varying,
        "language" character varying NOT NULL,
        "content" text,
        "url" character varying,
        "lastUpdated" date,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_legal_sources" PRIMARY KEY ("id")
      )
    `);

    // Create embeddings table (with pgvector)
    await queryRunner.query(`
      CREATE TABLE "embeddings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "legalSourceId" uuid,
        "text" text NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "section" character varying,
        "metadata" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_embeddings" PRIMARY KEY ("id")
      )
    `);

    // Create document_jobs table
    await queryRunner.query(`
      CREATE TABLE "document_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "documentId" uuid NOT NULL,
        "type" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'pending',
        "progress" integer NOT NULL DEFAULT 0,
        "attempts" integer NOT NULL DEFAULT 0,
        "lastError" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_jobs" PRIMARY KEY ("id")
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "actorUserId" uuid NOT NULL,
        "action" character varying NOT NULL,
        "targetType" character varying NOT NULL,
        "targetId" uuid,
        "ip" character varying,
        "userAgent" character varying,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);

    // Create workspace_settings table
    await queryRunner.query(`
      CREATE TABLE "workspace_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "defaultFileRetentionDays" integer NOT NULL DEFAULT 30,
        "defaultTextEmbeddingsRetentionDays" integer NOT NULL DEFAULT 90,
        "noLogsEnabled" boolean NOT NULL DEFAULT false,
        "retentionOverrides" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_workspace_settings_workspaceId" UNIQUE ("workspaceId"),
        CONSTRAINT "PK_workspace_settings" PRIMARY KEY ("id")
      )
    `);

    // Add foreign keys
    await queryRunner.query(`
      ALTER TABLE "workspace_members"
      ADD CONSTRAINT "FK_workspace_members_workspaceId"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_members"
      ADD CONSTRAINT "FK_workspace_members_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "FK_documents_workspaceId"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "document_files"
      ADD CONSTRAINT "FK_document_files_documentId"
      FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "chunks"
      ADD CONSTRAINT "FK_chunks_documentId"
      FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "embeddings"
      ADD CONSTRAINT "FK_embeddings_legalSourceId"
      FOREIGN KEY ("legalSourceId") REFERENCES "legal_sources"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "document_jobs"
      ADD CONSTRAINT "FK_document_jobs_documentId"
      FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs"
      ADD CONSTRAINT "FK_audit_logs_workspaceId"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "workspace_settings"
      ADD CONSTRAINT "FK_workspace_settings_workspaceId"
      FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE
    `);

    // Create indexes for better query performance
    await queryRunner.query(`CREATE INDEX "IDX_workspace_members_workspaceId" ON "workspace_members" ("workspaceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_workspace_members_userId" ON "workspace_members" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_workspaceId" ON "documents" ("workspaceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_documents_status" ON "documents" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_document_files_documentId" ON "document_files" ("documentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_chunks_documentId" ON "chunks" ("documentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_embeddings_legalSourceId" ON "embeddings" ("legalSourceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_document_jobs_documentId" ON "document_jobs" ("documentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_document_jobs_status" ON "document_jobs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_workspaceId" ON "audit_logs" ("workspaceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_actorUserId" ON "audit_logs" ("actorUserId")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_createdAt" ON "audit_logs" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_legal_sources_country" ON "legal_sources" ("country")`);
    await queryRunner.query(`CREATE INDEX "IDX_legal_sources_jurisdiction" ON "legal_sources" ("jurisdiction")`);

    // Create pgvector index for similarity search (using HNSW for better performance)
    await queryRunner.query(`CREATE INDEX "IDX_chunks_embedding_hnsw" ON "chunks" USING hnsw ("embedding" vector_cosine_ops)`);
    await queryRunner.query(`CREATE INDEX "IDX_embeddings_embedding_hnsw" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_embeddings_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chunks_embedding_hnsw"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_legal_sources_jurisdiction"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_legal_sources_country"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_actorUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_logs_workspaceId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_document_jobs_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_document_jobs_documentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_embeddings_legalSourceId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_chunks_documentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_document_files_documentId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_documents_workspaceId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workspace_members_userId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_workspace_members_workspaceId"`);

    // Drop foreign keys
    await queryRunner.query(`ALTER TABLE "workspace_settings" DROP CONSTRAINT IF EXISTS "FK_workspace_settings_workspaceId"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT IF EXISTS "FK_audit_logs_workspaceId"`);
    await queryRunner.query(`ALTER TABLE "document_jobs" DROP CONSTRAINT IF EXISTS "FK_document_jobs_documentId"`);
    await queryRunner.query(`ALTER TABLE "embeddings" DROP CONSTRAINT IF EXISTS "FK_embeddings_legalSourceId"`);
    await queryRunner.query(`ALTER TABLE "chunks" DROP CONSTRAINT IF EXISTS "FK_chunks_documentId"`);
    await queryRunner.query(`ALTER TABLE "document_files" DROP CONSTRAINT IF EXISTS "FK_document_files_documentId"`);
    await queryRunner.query(`ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "FK_documents_workspaceId"`);
    await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "FK_workspace_members_userId"`);
    await queryRunner.query(`ALTER TABLE "workspace_members" DROP CONSTRAINT IF EXISTS "FK_workspace_members_workspaceId"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "embeddings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "legal_sources"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chunks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspace_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "workspaces"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    // Drop pgvector extension (optional - might be used by other databases)
    // await queryRunner.query(`DROP EXTENSION IF EXISTS vector;`);
  }
}
