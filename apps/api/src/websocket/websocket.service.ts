import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  type DocumentJob,
  JOB_PROGRESS_EVENT,
  documentRoom,
} from '@contractai-review/shared';

@Injectable()
export class WebSocketService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitJobProgress(documentId: string, workspaceId: string, job: DocumentJob): void {
    if (!this.server) return;
    const room = documentRoom(workspaceId, documentId);
    this.server.to(room).emit(JOB_PROGRESS_EVENT, { documentId, workspaceId, job });
  }
}
