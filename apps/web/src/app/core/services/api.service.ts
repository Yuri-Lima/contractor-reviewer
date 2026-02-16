import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import {
  Workspace,
  CreateWorkspaceRequest,
  AddMemberRequest,
  WorkspaceMember,
  Document,
  CreateDocumentRequest,
  DocumentJob,
  ChatRequest,
  ChatResponse,
  RedlineRequest,
  RedlineResponse,
  DocumentVersion,
  RetentionConfig,
  DocumentFile,
  WorkspaceSettingsConfig,
  UpdateWorkspaceSettingsRequest,
  PromptListItem,
  PromptResponse,
  ListPromptsResponse,
  ParserInfo,
} from '@contractai-review/shared';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private http: HttpClient) {}

  // Workspaces
  getWorkspaces(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}`);
  }

  createWorkspace(data: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<Workspace>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}`, data);
  }

  getWorkspace(workspaceId: string): Observable<Workspace> {
    return this.http.get<Workspace>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}`);
  }

  deleteWorkspace(workspaceId: string): Observable<void> {
    return this.http.delete<void>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}`);
  }

  getWorkspaceMembers(workspaceId: string): Observable<WorkspaceMember[]> {
    return this.http.get<WorkspaceMember[]>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/members`);
  }

  addMember(workspaceId: string, data: AddMemberRequest): Observable<WorkspaceMember> {
    return this.http.post<WorkspaceMember>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/members`, data);
  }

  removeMember(workspaceId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/members/${userId}`);
  }

  // Documents
  getDocuments(workspaceId: string): Observable<Document[]> {
    return this.http.get<Document[]>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}`);
  }

  createDocument(workspaceId: string, data: CreateDocumentRequest): Observable<Document> {
    return this.http.post<Document>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}`, data);
  }

  getDocument(workspaceId: string, documentId: string): Observable<Document> {
    return this.http.get<Document>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}`,
    );
  }

  deleteDocument(workspaceId: string, documentId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}`,
    );
  }

  getDocumentParsers(workspaceId: string): Observable<ParserInfo[]> {
    return this.http.get<ParserInfo[]>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentParsers(workspaceId)}`,
    );
  }

  uploadFile(workspaceId: string, documentId: string, file: File, parser?: string): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (parser) formData.append('parser', parser);
    return this.http.post(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files`,
      formData,
    );
  }

  downloadFile(workspaceId: string, documentId: string, fileId: string): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/download`;
  }

  downloadFileAsBlob(workspaceId: string, documentId: string, fileId: string): Observable<Blob> {
    return this.http.get(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/download`,
      { responseType: 'blob' },
    );
  }

  getDocumentFiles(workspaceId: string, documentId: string, params?: any): Observable<{ files: DocumentFile[]; total: number; limit: number; offset: number }> {
    return this.http.get<{ files: DocumentFile[]; total: number; limit: number; offset: number }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files`,
      { params }
    );
  }

  deleteFile(workspaceId: string, documentId: string, fileId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}`,
    );
  }

  getDocumentJobs(workspaceId: string, documentId: string): Observable<DocumentJob[]> {
    return this.http.get<DocumentJob[]>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/jobs`,
    );
  }

  // Chat
  chat(workspaceId: string, documentId: string, request: ChatRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}`,
      request,
    );
  }

  // Redline
  generateRedline(workspaceId: string, documentId: string, request: RedlineRequest): Observable<RedlineResponse> {
    return this.http.post<RedlineResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.redline(workspaceId, documentId)}`,
      request,
    );
  }

  applyRedline(
    workspaceId: string,
    documentId: string,
    versionId: string,
    decisions?: Array<{ blockId: string; decision: 'accept' | 'reject' }>,
    finalText?: string,
  ): Observable<{ versionId: string; versionNumber: number; finalText: string; createdAt: string }> {
    const body: { decisions?: Array<{ blockId: string; decision: 'accept' | 'reject' }>; finalText?: string } = {};
    if (decisions) {
      body.decisions = decisions;
    }
    if (finalText) {
      body.finalText = finalText;
    }
    return this.http.post<{ versionId: string; versionNumber: number; finalText: string; createdAt: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.redline(workspaceId, documentId)}/${versionId}/apply`,
      body,
    );
  }

  getDocumentVersions(workspaceId: string, documentId: string): Observable<DocumentVersion[]> {
    return this.http.get<DocumentVersion[]>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/versions`,
    );
  }

  getDocumentContent(workspaceId: string, documentId: string): Observable<{ content: string; versionNumber: number; lastUpdated: string }> {
    return this.http.get<{ content: string; versionNumber: number; lastUpdated: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/content`,
    );
  }

  getVersionContent(workspaceId: string, documentId: string, versionId: string): Observable<{ content: string; versionNumber: number; createdAt: string }> {
    return this.http.get<{ content: string; versionNumber: number; createdAt: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/versions/${versionId}/content`,
    );
  }

  // Privacy
  exportPrivacyData(workspaceId: string): Observable<any> {
    return this.http.get(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/export`, {
      responseType: 'blob',
    });
  }

  getNoLogsConfig(workspaceId: string): Observable<{ enabled: boolean; config?: any }> {
    return this.http.get<{ enabled: boolean; config?: any }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/no-logs`,
    );
  }

  toggleNoLogs(workspaceId: string, enabled: boolean, config?: any): Observable<any> {
    return this.http.post(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/no-logs`, {
      enabled,
      config,
    });
  }

  // Audit
  getAuditLogs(workspaceId: string, params?: any): Observable<any> {
    return this.http.get(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.audit(workspaceId)}`, { params });
  }

  // Retention
  getRetentionConfig(workspaceId: string): Observable<RetentionConfig> {
    return this.http.get<RetentionConfig>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.retention(workspaceId)}`);
  }

  updateRetentionConfig(workspaceId: string, config: Partial<RetentionConfig>): Observable<RetentionConfig> {
    return this.http.put<RetentionConfig>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.retention(workspaceId)}`, config);
  }

  // Workspace Settings (unified: retention, document processing, etc.)
  getWorkspaceSettings(workspaceId: string): Observable<WorkspaceSettingsConfig> {
    return this.http.get<WorkspaceSettingsConfig>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.settings(workspaceId)}`);
  }

  updateWorkspaceSettings(
    workspaceId: string,
    config: UpdateWorkspaceSettingsRequest,
  ): Observable<WorkspaceSettingsConfig> {
    return this.http.put<WorkspaceSettingsConfig>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.settings(workspaceId)}`,
      config,
    );
  }

  // Prompts (admin)
  getPrompts(workspaceId: string): Observable<ListPromptsResponse> {
    return this.http.get<ListPromptsResponse>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.prompts(workspaceId)}`);
  }

  getPrompt(workspaceId: string, key: string): Observable<PromptResponse> {
    return this.http.get<PromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.prompts(workspaceId)}/${encodeURIComponent(key)}`,
    );
  }

  updatePrompt(workspaceId: string, key: string, content: string): Observable<PromptResponse> {
    return this.http.put<PromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.prompts(workspaceId)}/${encodeURIComponent(key)}`,
      { content },
    );
  }

  resetPrompt(workspaceId: string, key: string): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.prompts(workspaceId)}/${encodeURIComponent(key)}`,
    );
  }

  // Account
  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}`);
  }

  // Users
  searchUserByEmail(email: string): Observable<{ id: string; email: string; name: string }> {
    return this.http.get<{ id: string; email: string; name: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.users.search}?email=${encodeURIComponent(email)}`
    );
  }
}
