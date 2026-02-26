import { WorkspaceRole } from '../enums/workspace.enum';
import { RetentionConfig } from './common';
import type { TranscriptionProviderId } from './transcription';

export interface WorkspaceSettingsConfig {
  retention: RetentionConfig;
  general?: Record<string, unknown>;
  documentProcessing: {
    chunkingStrategy: string;
    defaultDocumentParser?: string;
    parserApiKeys?: Record<string, boolean>;
  };
  /** Transcription provider API keys (masked: configured/not) */
  transcriptionProviderApiKeys?: Record<TranscriptionProviderId, boolean>;
  /** Preferred transcription provider for this workspace (huggingface | openai) */
  preferredTranscriptionProvider?: TranscriptionProviderId | null;
}

/**
 * Response from GET workspace settings. Includes currentUserRole so the frontend
 * can show/hide API key edit UI for non-admin roles.
 */
export interface WorkspaceSettingsGetResponse extends WorkspaceSettingsConfig {
  currentUserRole: WorkspaceRole;
}

/**
 * Request body for PATCH-style workspace settings updates.
 * All fields are optional; only provided fields are updated.
 * parserApiKeys: when writing, use string (raw API key) to set/update, false to remove.
 * API never returns raw keys; response uses Record<string, boolean> (configured/not).
 */
export interface UpdateWorkspaceSettingsRequest {
  retention?: Partial<RetentionConfig>;
  general?: Record<string, unknown>;
  documentProcessing?: {
    chunkingStrategy?: string;
    defaultDocumentParser?: string;
    parserApiKeys?: Record<string, string | boolean>;
  };
  /** Transcription keys: provider id -> string (set) | false (remove) */
  transcriptionProviderApiKeys?: Record<TranscriptionProviderId, string | boolean>;
  /** Preferred transcription provider (huggingface | openai) */
  preferredTranscriptionProvider?: TranscriptionProviderId | null;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface AddMemberRequest {
  userId: string;
  role: WorkspaceRole;
}
