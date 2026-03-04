import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { API_CONFIG } from '../config/api.config';
import { AuthService } from './auth.service';
import {
  type DocumentJob,
  JOB_PROGRESS_EVENT,
} from '@contractai-review/shared';

@Injectable({
  providedIn: 'root',
})
export class WebSocketService {
  private socket: Socket | null = null;

  constructor(private authService: AuthService) {}

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Connect to WebSocket server. Call when user is authenticated. */
  connect(): void {
    if (this.socket?.connected) return;

    const token = this.authService.getToken();
    const wsUrl = API_CONFIG.wsUrl;
    if (!token || !wsUrl) return;

    this.socket = io(wsUrl, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Subscribe to document job progress events.
   * Returns an Observable that emits when job progress is received.
   * Caller should unsubscribe when leaving the document view.
   */
  subscribeDocument(
    workspaceId: string,
    documentId: string,
  ): Observable<{ documentId: string; workspaceId: string; job: DocumentJob }> {
    return new Observable((subscriber) => {
      const handler = (data: { documentId: string; workspaceId: string; job: DocumentJob }) => {
        if (data.documentId === documentId && data.workspaceId === workspaceId) {
          subscriber.next(data);
        }
      };

      const doSubscribe = () => {
        if (!this.socket) return;
        this.socket.on(JOB_PROGRESS_EVENT, handler);
        this.socket.emit(
          'subscribe',
          { workspaceId, documentId },
          (response?: { event?: string; data?: { error?: string } }) => {
            if (response?.event === 'error') {
              this.socket?.off(JOB_PROGRESS_EVENT, handler);
              this.unsubscribeDocument(workspaceId, documentId);
              subscriber.error(new Error(response.data?.error ?? 'Subscribe failed'));
            }
          },
        );
      };

      if (!this.socket?.connected) {
        this.connect();
        if (!this.socket) {
          subscriber.complete();
          return;
        }
        this.socket.once('connect', doSubscribe);
      } else {
        doSubscribe();
      }

      return () => {
        this.socket?.off(JOB_PROGRESS_EVENT, handler);
        this.unsubscribeDocument(workspaceId, documentId);
      };
    });
  }

  /**
   * Unsubscribe from document. Call when leaving document view.
   */
  unsubscribeDocument(workspaceId: string, documentId: string): void {
    this.socket?.emit('unsubscribe', { workspaceId, documentId });
  }
}
