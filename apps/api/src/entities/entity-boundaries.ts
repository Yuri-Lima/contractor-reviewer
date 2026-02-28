import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { Document } from './document.entity';
import { DocumentFile } from './document-file.entity';
import { DocumentJob } from './document-job.entity';
import { ChatMessage } from './chat-message.entity';
import { DocumentVersion } from './document-version.entity';
import { AuditLog } from './audit-log.entity';
import { WorkspaceSettings } from './workspace-settings.entity';
import { LegalSource } from './legal-source.entity';
import { UserOnboarding } from './user-onboarding.entity';
import { UserStorageSettings } from './user-storage-settings.entity';
import { Prompt } from './prompt.entity';
import { ImageAsset } from './image-asset.entity';
import { Chunk } from './chunk.entity';
import { Embedding } from './embedding.entity';
import type { EntityTarget } from 'typeorm';

/**
 * Relational entities - live in the main (relational) database.
 * When separating DBs, these stay with DATABASE_URL.
 */
export const RELATIONAL_ENTITIES: EntityTarget<unknown>[] = [
  User,
  Workspace,
  WorkspaceMember,
  Document,
  DocumentFile,
  DocumentJob,
  ChatMessage,
  DocumentVersion,
  AuditLog,
  WorkspaceSettings,
  LegalSource,
  UserOnboarding,
  UserStorageSettings,
  Prompt,
  ImageAsset,
];

/**
 * Vector entities - contain embedding columns, move to vector DB when separated.
 * legal_sources stays relational; embeddings has denormalized columns (sourceName, country, jurisdiction, url).
 */
export const VECTOR_ENTITIES: EntityTarget<unknown>[] = [Chunk, Embedding];
