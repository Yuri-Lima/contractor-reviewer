import { WorkspaceRole } from '../enums/workspace.enum';
import { RetentionConfig } from './common';

export interface WorkspaceSettingsConfig {
  retention: RetentionConfig;
  general?: Record<string, unknown>;
  documentProcessing: { chunkingStrategy: string };
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
