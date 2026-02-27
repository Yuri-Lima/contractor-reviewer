import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';
import { getAudioExtensionFromMime } from '@contractai-review/shared/constants';
import {
  User,
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddMemberRequest,
  WorkspaceMember,
  WorkspaceRole,
  Document,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  DocumentJob,
  ChatRequest,
  ChatResponse,
  RedlineRequest,
  RedlineResponse,
  DocumentVersion,
  RetentionConfig,
  DocumentFile,
  FileContentResponse,
  WorkspaceSettingsConfig,
  WorkspaceSettingsGetResponse,
  UpdateWorkspaceSettingsRequest,
  PromptListItem,
  PromptResponse,
  ListPromptsResponse,
  ParserInfo,
  OnboardingState,
  UpdateChecklistRequest,
  UpdateTourRequest,
  UpdateVisitedRouteRequest,
  UserStorageConfigResponse,
  UpdateUserStorageRequest,
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

  updateWorkspace(workspaceId: string, data: UpdateWorkspaceRequest): Observable<Workspace> {
    return this.http.patch<Workspace>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}`,
      data,
    );
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

  /**
   * Fetches the workspace logo as blob and returns an object URL for display.
   * Use this instead of presigned URL to support local storage (which has no
   * /api/storage endpoint). Caller should revoke the URL when done to avoid leaks.
   */
  getWorkspaceLogoBlobUrl(workspaceId: string): Observable<string | null> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob)),
      catchError(() => of(null)),
    );
  }

  uploadWorkspaceLogo(workspaceId: string, file: File): Observable<void> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`,
      formData,
    );
  }

  getWorkspaceLogoUrl(workspaceId: string): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`;
  }

  deleteWorkspaceLogo(workspaceId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`,
    );
  }

  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Observable<WorkspaceMember> {
    return this.http.put<WorkspaceMember>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/members/${userId}/role`,
      { role },
    );
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

  updateDocument(
    workspaceId: string,
    documentId: string,
    data: UpdateDocumentRequest,
  ): Observable<Document> {
    return this.http.patch<Document>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}`,
      data,
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

  getFileContent(workspaceId: string, documentId: string, fileId: string): Observable<FileContentResponse> {
    return this.http.get<FileContentResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/content`,
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

  synthesizeSpeech(
    workspaceId: string,
    documentId: string,
    text: string,
    language?: string,
  ): Observable<Blob> {
    return this.http.post(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/synthesize`,
      { text, language },
      { responseType: 'blob' },
    );
  }

  transcribe(
    workspaceId: string,
    documentId: string,
    audioBlob: Blob,
    language?: string,
  ): Observable<{ text: string }> {
    const formData = new FormData();
    const ext = getAudioExtensionFromMime(audioBlob.type || 'audio/webm');
    formData.append('audio', audioBlob, `audio.${ext}`);
    if (language) {
      formData.append('language', language);
    }
    return this.http.post<{ text: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/transcribe`,
      formData,
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
  getWorkspaceSettings(workspaceId: string): Observable<WorkspaceSettingsGetResponse> {
    return this.http.get<WorkspaceSettingsGetResponse>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.settings(workspaceId)}`);
  }

  updateWorkspaceSettings(
    workspaceId: string,
    config: UpdateWorkspaceSettingsRequest,
  ): Observable<WorkspaceSettingsGetResponse> {
    return this.http.put<WorkspaceSettingsGetResponse>(
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

  // Onboarding
  getOnboardingState(): Observable<OnboardingState> {
    return this.http.get<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}`,
    );
  }

  updateOnboardingChecklist(request: UpdateChecklistRequest): Observable<OnboardingState> {
    return this.http.patch<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/checklist`,
      request,
    );
  }

  updateOnboardingTour(request: UpdateTourRequest): Observable<OnboardingState> {
    return this.http.patch<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/tour`,
      request,
    );
  }

  updateVisitedRoute(request: UpdateVisitedRouteRequest): Observable<OnboardingState> {
    return this.http.patch<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/visited-routes`,
      request,
    );
  }

  completeOnboarding(): Observable<OnboardingState> {
    return this.http.post<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/complete`,
      {},
    );
  }

  dismissOnboarding(): Observable<OnboardingState> {
    return this.http.post<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/dismiss`,
      {},
    );
  }

  resetOnboarding(): Observable<OnboardingState> {
    return this.http.post<OnboardingState>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.onboarding}/reset`,
      {},
    );
  }

  // Account
  getAccount(): Observable<User> {
    return this.http.get<User>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}`);
  }

  uploadAvatar(file: File): Observable<User> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<User>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`,
      formData,
    );
  }

  getAvatarUrl(): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`;
  }

  deleteAvatar(): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`,
    );
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}`);
  }

  getAccountStorage(): Observable<UserStorageConfigResponse> {
    return this.http.get<UserStorageConfigResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/storage`,
    );
  }

  updateAccountStorage(request: UpdateUserStorageRequest): Observable<UserStorageConfigResponse> {
    return this.http.put<UserStorageConfigResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/storage`,
      request,
    );
  }

  deleteAccountStorage(): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/storage`,
    );
  }

  // Users
  searchUserByEmail(email: string): Observable<{ id: string; email: string; name: string }> {
    return this.http.get<{ id: string; email: string; name: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.users.search}?email=${encodeURIComponent(email)}`
    );
  }
}
