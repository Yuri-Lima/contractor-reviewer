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
  auditLogs: Array<{
    action: string;
    targetType: string;
    createdAt: string;
  }>;
}
