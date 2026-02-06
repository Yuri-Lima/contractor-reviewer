export interface Workspace {
  id: string;
  name: string;
  createdAt: string;
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

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export interface CreateWorkspaceRequest {
  name: string;
}

export interface AddMemberRequest {
  userId: string;
  role: WorkspaceRole;
}
