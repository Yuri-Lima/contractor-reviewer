import type { DocumentJob } from './documents';

/** Payload emitted on job:progress event */
export interface JobProgressEvent {
  documentId: string;
  workspaceId: string;
  job: DocumentJob;
}

/** Payload for subscribe request from client */
export interface SubscribeDocumentPayload {
  workspaceId: string;
  documentId: string;
}
