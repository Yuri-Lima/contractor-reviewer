import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { Workspace, CreateWorkspaceRequest, AddMemberRequest, WorkspaceMember } from '../models/workspace.model';
import { Document, CreateDocumentRequest, DocumentJob } from '../models/document.model';
import { ChatRequest, ChatResponse } from '../models/chat.model';
import { RedlineRequest, RedlineResponse } from '../models/redline.model';
import { RetentionConfig } from '../models/retention.model';

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

  uploadFile(workspaceId: string, documentId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
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

  // Privacy
  exportPrivacyData(workspaceId: string): Observable<any> {
    return this.http.get(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/export`, {
      responseType: 'blob',
    });
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
