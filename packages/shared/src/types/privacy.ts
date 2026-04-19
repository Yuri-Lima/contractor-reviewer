export interface PrivacyExportData {
  workspaceId: string;
  exportedAt: string;
  /** Conversation summaries (thread/document memory) for DSAR export */
  memories?: Array<{
    id: string;
    scopeType: string;
    scopeId: string;
    content: string;
    version: number;
    updatedAt: string;
  }>;
  chatMessages: Array<{
    id: string;
    documentId: string;
    question: string;
    answerText: string | null;
    confidence: string | null;
    citations: Array<any> | null;
    notFound: boolean;
    createdAt: string;
  }>;
  versions: Array<{
    id: string;
    documentId: string;
    versionNumber: number;
    playbook: string | null;
    changes: Array<any> | null;
    createdAt: string;
  }>;
  redlinePrompts: Array<{
    id: string;
    documentId: string;
    playbook: string;
    prompt: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    action: string;
    targetType: string;
    createdAt: string;
  }>;
}
