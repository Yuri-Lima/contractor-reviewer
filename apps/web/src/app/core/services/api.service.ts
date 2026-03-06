import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { API_CONFIG } from '../config/api.config';
import { AuthService } from './auth.service';
import { getAudioExtensionFromMime } from '@contractai-review/shared/constants';
import type { StreamEvent } from '@contractai-review/shared';
import {
  User,
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  AddMemberRequest,
  InviteMemberRequest,
  WorkspaceMember,
  WorkspaceRole,
  Document,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GeneratePromptResponse,
  DocumentJob,
  ChatPrepareResponse,
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
  UpdateAccountPreferencesRequest,
} from '@contractai-review/shared';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

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

  inviteMember(
    workspaceId: string,
    data: InviteMemberRequest,
  ): Observable<WorkspaceMember> {
    return this.http.post<WorkspaceMember>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/members/invite`,
      data,
    );
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

  uploadWorkspaceLogo(
    workspaceId: string,
    file: File,
    options?: { signal?: AbortSignal },
  ): Observable<void> {
    if (options?.signal !== undefined) {
      return this.fetchUploadWorkspaceLogo(workspaceId, file, options.signal);
    }
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`,
      formData,
    );
  }

  private fetchUploadWorkspaceLogo(
    workspaceId: string,
    file: File,
    signal: AbortSignal,
  ): Observable<void> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.workspaces}/${workspaceId}/logo`;
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'POST', body: formData, signal, headers }).then(
        async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw {
              status: res.status,
              error: body,
              message: body?.message ?? res.statusText,
            };
          }
        },
      ),
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

  generateDocumentPrompt(
    workspaceId: string,
    title: string,
    description: string,
    contextMarkdown?: string,
    options?: { signal?: AbortSignal },
  ): Observable<GeneratePromptResponse> {
    const body = { title, description, contextMarkdown };
    if (options?.signal !== undefined) {
      return this.fetchGenerateDocumentPrompt(
        workspaceId,
        body,
        options.signal,
      );
    }
    return this.http.post<GeneratePromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentsGeneratePrompt(workspaceId)}`,
      body,
    );
  }

  private fetchGenerateDocumentPrompt(
    workspaceId: string,
    body: { title: string; description: string; contextMarkdown?: string },
    signal: AbortSignal,
  ): Observable<GeneratePromptResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentsGeneratePrompt(workspaceId)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: errBody,
            message: errBody?.message ?? res.statusText,
          };
        }
        return res.json() as Promise<GeneratePromptResponse>;
      }),
    );
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

  reEvaluateJurisdiction(workspaceId: string, documentId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentReEvaluateJurisdiction(workspaceId, documentId)}`,
      {},
    );
  }

  getDocumentParsers(workspaceId: string): Observable<ParserInfo[]> {
    return this.http.get<ParserInfo[]>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentParsers(workspaceId)}`,
    );
  }

  uploadFile(
    workspaceId: string,
    documentId: string,
    file: File,
    parser?: string,
    options?: { signal?: AbortSignal },
  ): Observable<DocumentFile> {
    if (options?.signal !== undefined) {
      return this.fetchUploadFile(
        workspaceId,
        documentId,
        file,
        parser,
        options.signal,
      );
    }
    const formData = new FormData();
    formData.append('file', file);
    if (parser) formData.append('parser', parser);
    return this.http.post<DocumentFile>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files`,
      formData,
    );
  }

  private fetchUploadFile(
    workspaceId: string,
    documentId: string,
    file: File,
    parser?: string,
    signal?: AbortSignal,
  ): Observable<DocumentFile> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files`;
    const formData = new FormData();
    formData.append('file', file);
    if (parser) formData.append('parser', parser);
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'POST', body: formData, signal, headers }).then(
        async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw {
              status: res.status,
              error: body,
              message: body?.message ?? res.statusText,
            };
          }
          return res.json() as Promise<DocumentFile>;
        },
      ),
    );
  }

  downloadFile(workspaceId: string, documentId: string, fileId: string): string {
    return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/download`;
  }

  downloadFileAsBlob(
    workspaceId: string,
    documentId: string,
    fileId: string,
    options?: { signal?: AbortSignal },
  ): Observable<Blob> {
    if (options?.signal !== undefined) {
      return this.fetchDownloadFileAsBlob(
        workspaceId,
        documentId,
        fileId,
        options.signal,
      );
    }
    return this.http.get(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/download`,
      { responseType: 'blob' },
    ) as Observable<Blob>;
  }

  private fetchDownloadFileAsBlob(
    workspaceId: string,
    documentId: string,
    fileId: string,
    signal: AbortSignal,
  ): Observable<Blob> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documents(workspaceId)}/${documentId}/files/${fileId}/download`;
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'GET', signal, headers }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.blob();
      }),
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
  createChatThread(
    workspaceId: string,
    documentId: string,
    title?: string | null,
  ): Observable<{
    id: string;
    documentId: string;
    workspaceId: string;
    userId: string;
    title: string | null;
    createdAt: string;
    updatedAt: string;
  }> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/threads`;
    return this.http.post<{
      id: string;
      documentId: string;
      workspaceId: string;
      userId: string;
      title: string | null;
      createdAt: string;
      updatedAt: string;
    }>(url, { title: title ?? undefined });
  }

  deleteChatThread(
    workspaceId: string,
    documentId: string,
    threadId: string,
  ): Observable<void> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/threads/${threadId}`;
    return this.http.delete<void>(url);
  }

  exportChatThread(
    workspaceId: string,
    documentId: string,
    threadId: string,
  ): Observable<Blob> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/threads/${threadId}/export`;
    return this.http.get(url, { responseType: 'blob' });
  }

  getChatThreads(
    workspaceId: string,
    documentId: string,
    params?: { page?: number; limit?: number },
  ): Observable<{
    threads: Array<{
      id: string;
      documentId: string;
      workspaceId: string;
      userId: string;
      title: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const p = params ?? {};
    const query = new URLSearchParams();
    if (p.page != null) query.set('page', String(p.page));
    if (p.limit != null) query.set('limit', String(p.limit));
    const qs = query.toString();
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/threads${qs ? `?${qs}` : ''}`;
    return this.http.get<{
      threads: Array<{
        id: string;
        documentId: string;
        workspaceId: string;
        userId: string;
        title: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(url);
  }

  getChatMessages(
    workspaceId: string,
    documentId: string,
    threadId: string,
    params?: { page?: number; limit?: number },
  ): Observable<{
    messages: Array<{
      id: string;
      threadId: string;
      question: string;
      answerText: string | null;
      confidence: string | null;
      citations: unknown;
      notFound: boolean;
      role: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const p = params ?? {};
    const query = new URLSearchParams();
    if (p.page != null) query.set('page', String(p.page));
    if (p.limit != null) query.set('limit', String(p.limit));
    const qs = query.toString();
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/threads/${threadId}/messages${qs ? `?${qs}` : ''}`;
    return this.http.get<{
      messages: Array<{
        id: string;
        threadId: string;
        question: string;
        answerText: string | null;
        confidence: string | null;
        citations: unknown;
        notFound: boolean;
        role: string;
        createdAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(url);
  }

  chatStream(
    workspaceId: string,
    documentId: string,
    request: ChatRequest,
    options?: { signal?: AbortSignal },
  ): Observable<StreamEvent> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chatStream(workspaceId, documentId)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return new Observable<StreamEvent>((subscriber) => {
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal: options?.signal,
        headers,
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            subscriber.error({
              status: res.status,
              error: body,
              message: body?.message ?? res.statusText,
            });
            return;
          }
          const reader = res.body?.getReader();
          if (!reader) {
            subscriber.error(new Error('No response body'));
            return;
          }
          const decoder = new TextDecoder();
          let buffer = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() ?? '';
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6)) as StreamEvent;
                    console.log(
                      '[ChatFlow] Parse SSE event:',
                      data.type,
                      data.type === 'chunk' ? `contentLength=${(data as { content?: string }).content?.length ?? 0}` : '',
                    );
                    subscriber.next(data);
                    if (data.type === 'error' || data.type === 'done') {
                      subscriber.complete();
                      return;
                    }
                  } catch {
                    /* skip invalid JSON */
                  }
                }
              }
            }
            subscriber.complete();
          } catch (err) {
            if ((err as { name?: string }).name !== 'AbortError') {
              subscriber.error(err);
            }
            subscriber.complete();
          }
        })
        .catch((err) => {
          subscriber.error(err);
        });
    });
  }

  chat(
    workspaceId: string,
    documentId: string,
    request: ChatRequest,
    options?: { signal?: AbortSignal },
  ): Observable<ChatResponse> {
    if (options?.signal !== undefined) {
      return this.fetchChat(workspaceId, documentId, request, options.signal);
    }
    return this.http.post<ChatResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}`,
      request,
    );
  }

  private fetchChat(
    workspaceId: string,
    documentId: string,
    request: ChatRequest,
    signal: AbortSignal,
  ): Observable<ChatResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.json() as Promise<ChatResponse>;
      }),
    );
  }

  chatPrepare(
    workspaceId: string,
    documentId: string,
    request: ChatRequest,
    options?: { signal?: AbortSignal },
  ): Observable<ChatPrepareResponse> {
    if (options?.signal !== undefined) {
      return this.fetchChatPrepare(workspaceId, documentId, request, options.signal);
    }
    return this.http.post<ChatPrepareResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/prepare`,
      request,
    );
  }

  private fetchChatPrepare(
    workspaceId: string,
    documentId: string,
    request: ChatRequest,
    signal: AbortSignal,
  ): Observable<ChatPrepareResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/prepare`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.json() as Promise<ChatPrepareResponse>;
      }),
    );
  }

  chatExecute(
    workspaceId: string,
    documentId: string,
    requestId: string,
    options?: { signal?: AbortSignal },
  ): Observable<ChatResponse> {
    if (options?.signal !== undefined) {
      return this.fetchChatExecute(workspaceId, documentId, requestId, options.signal);
    }
    return this.http.post<ChatResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/execute`,
      { requestId },
    );
  }

  private fetchChatExecute(
    workspaceId: string,
    documentId: string,
    requestId: string,
    signal: AbortSignal,
  ): Observable<ChatResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/execute`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ requestId }),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.json() as Promise<ChatResponse>;
      }),
    );
  }

  synthesizeSpeech(
    workspaceId: string,
    documentId: string,
    text: string,
    language?: string,
    options?: { signal?: AbortSignal },
  ): Observable<Blob> {
    if (options?.signal !== undefined) {
      return this.fetchSynthesizeSpeech(
        workspaceId,
        documentId,
        text,
        language,
        options.signal,
      );
    }
    return this.http.post(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/synthesize`,
      { text, language },
      { responseType: 'blob' },
    ) as Observable<Blob>;
  }

  private fetchSynthesizeSpeech(
    workspaceId: string,
    documentId: string,
    text: string,
    language: string | undefined,
    signal: AbortSignal,
  ): Observable<Blob> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/synthesize`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify({ text, language }),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.blob();
      }),
    );
  }

  transcribe(
    workspaceId: string,
    documentId: string,
    audioBlob: Blob,
    language?: string,
    options?: { signal?: AbortSignal },
  ): Observable<{ text: string }> {
    if (options?.signal !== undefined) {
      return this.fetchTranscribe(
        workspaceId,
        documentId,
        audioBlob,
        language,
        options.signal,
      );
    }
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

  private fetchTranscribe(
    workspaceId: string,
    documentId: string,
    audioBlob: Blob,
    language?: string,
    signal?: AbortSignal,
  ): Observable<{ text: string }> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.chat(workspaceId, documentId)}/transcribe`;
    const formData = new FormData();
    const ext = getAudioExtensionFromMime(audioBlob.type || 'audio/webm');
    formData.append('audio', audioBlob, `audio.${ext}`);
    if (language) formData.append('language', language);
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'POST', body: formData, signal, headers }).then(
        async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw {
              status: res.status,
              error: body,
              message: body?.message ?? res.statusText,
            };
          }
          return res.json() as Promise<{ text: string }>;
        },
      ),
    );
  }

  // Redline
  generateRedline(
    workspaceId: string,
    documentId: string,
    request: RedlineRequest,
    options?: { signal?: AbortSignal },
  ): Observable<RedlineResponse> {
    if (options?.signal !== undefined) {
      return this.fetchGenerateRedline(
        workspaceId,
        documentId,
        request,
        options.signal,
      );
    }
    return this.http.post<RedlineResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.redline(workspaceId, documentId)}`,
      request,
    );
  }

  private fetchGenerateRedline(
    workspaceId: string,
    documentId: string,
    request: RedlineRequest,
    signal: AbortSignal,
  ): Observable<RedlineResponse> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.redline(workspaceId, documentId)}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
        headers,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.json() as Promise<RedlineResponse>;
      }),
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
  exportPrivacyData(
    workspaceId: string,
    options?: { signal?: AbortSignal },
  ): Observable<Blob> {
    if (options?.signal !== undefined) {
      return this.fetchExportPrivacyData(workspaceId, options.signal);
    }
    return this.http.get(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/export`,
      { responseType: 'blob' },
    ) as Observable<Blob>;
  }

  private fetchExportPrivacyData(
    workspaceId: string,
    signal: AbortSignal,
  ): Observable<Blob> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.privacy(workspaceId)}/export`;
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'GET', signal, headers }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw {
            status: res.status,
            error: body,
            message: body?.message ?? res.statusText,
          };
        }
        return res.blob();
      }),
    );
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

  // Global prompts (account settings)
  getAccountPrompts(): Observable<ListPromptsResponse> {
    return this.http.get<ListPromptsResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.accountPrompts()}`,
    );
  }

  updateAccountPrompt(key: string, content: string): Observable<PromptResponse> {
    return this.http.put<PromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.accountPrompts()}/${encodeURIComponent(key)}`,
      { content },
    );
  }

  resetAccountPrompt(key: string): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.accountPrompts()}/${encodeURIComponent(key)}`,
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

  // Document prompts (admin)
  getDocumentPrompts(
    workspaceId: string,
    documentId: string,
  ): Observable<ListPromptsResponse> {
    return this.http.get<ListPromptsResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentPrompts(workspaceId, documentId)}`,
    );
  }

  getDocumentPrompt(
    workspaceId: string,
    documentId: string,
    key: string,
  ): Observable<PromptResponse> {
    return this.http.get<PromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentPrompts(workspaceId, documentId)}/${encodeURIComponent(key)}`,
    );
  }

  updateDocumentPrompt(
    workspaceId: string,
    documentId: string,
    key: string,
    content: string,
  ): Observable<PromptResponse> {
    return this.http.put<PromptResponse>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentPrompts(workspaceId, documentId)}/${encodeURIComponent(key)}`,
      { content },
    );
  }

  resetDocumentPrompt(
    workspaceId: string,
    documentId: string,
    key: string,
  ): Observable<void> {
    return this.http.delete<void>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.documentPrompts(workspaceId, documentId)}/${encodeURIComponent(key)}`,
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

  updateAccountPreferences(request: UpdateAccountPreferencesRequest): Observable<User> {
    return this.http.patch<User>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/preferences`,
      request,
    );
  }

  uploadAvatar(
    file: File,
    options?: { signal?: AbortSignal },
  ): Observable<User> {
    if (options?.signal !== undefined) {
      return this.fetchUploadAvatar(file, options.signal);
    }
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<User>(
      `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`,
      formData,
    );
  }

  private fetchUploadAvatar(
    file: File,
    signal: AbortSignal,
  ): Observable<User> {
    const url = `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.account}/avatar`;
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = this.authService.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return from(
      fetch(url, { method: 'POST', body: formData, signal, headers }).then(
        async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw {
              status: res.status,
              error: body,
              message: body?.message ?? res.statusText,
            };
          }
          return res.json() as Promise<User>;
        },
      ),
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
