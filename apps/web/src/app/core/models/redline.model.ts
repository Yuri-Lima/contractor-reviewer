export enum RedlinePlaybook {
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  CLIENT_FRIENDLY = 'client-friendly',
}

export interface RedlineChange {
  section: string;
  original: string;
  suggested: string;
  reason: string;
}

export interface RedlineRequest {
  playbook: RedlinePlaybook;
  instructions?: string;
}

export interface RedlineResponse {
  versionId: string;
  changes: RedlineChange[];
  playbook: RedlinePlaybook;
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  workspaceId: string;
  userId: string;
  versionNumber: number;
  playbook: RedlinePlaybook | null;
  instructions: string | null;
  changes: RedlineChange[] | null;
  prompt: string | null;
  createdAt: string;
}
