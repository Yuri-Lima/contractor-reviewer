import { WorkspaceRole } from '../enums/workspace.enum';
import { RetentionConfig } from './common';

export interface WorkspaceSettingsConfig {
  retention: RetentionConfig;
  general?: Record<string, unknown>;
  documentProcessing: {
    chunkingStrategy: string;
    defaultDocumentParser?: string;
    parserApiKeys?: Record<string, boolean>;
  };
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
