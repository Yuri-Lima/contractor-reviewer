/**
 * Single source of truth for WebSocket / Redis Stream names.
 * Used by API (publisher, consumer, gateway) and frontend.
 */

/** Redis Stream name and Socket.IO event name for job progress */
export const JOB_PROGRESS_EVENT = 'job:progress';

/** Redis Stream consumer group for WebSocket consumers */
export const JOB_PROGRESS_CONSUMER_GROUP = 'ws-consumers';

/** Room prefix for document-scoped events */
export const DOCUMENT_ROOM_PREFIX = 'document';

/** Build room name for document job progress: document:{workspaceId}:{documentId} */
export function documentRoom(workspaceId: string, documentId: string): string {
  return `${DOCUMENT_ROOM_PREFIX}:${workspaceId}:${documentId}`;
}
