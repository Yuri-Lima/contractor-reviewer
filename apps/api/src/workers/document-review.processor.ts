import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { DocumentReviewService } from '../document-review/document-review.service';

export interface DocumentReviewJobData {
  documentId: string;
  workspaceId: string;
  /** When set, force re-running even if an idempotency hit exists. */
  force?: boolean;
}

/**
 * Phase 4 worker: kicks off a `DocumentReview` after the document's text is
 * available (post-OCR + jurisdiction evaluation). Idempotency on
 * (documentId, rulesVersion, llmModel) is enforced inside
 * `DocumentReviewService.runReview` so duplicate enqueues are cheap.
 *
 * The processor itself is intentionally thin — orchestration lives in the
 * service so the manual rerun endpoint and the post-parse trigger share one
 * code path.
 */
@Processor('document-review', {
  stalledInterval: 30000,
  maxStalledCount: 1,
})
@Injectable()
export class DocumentReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentReviewProcessor.name);

  constructor(private readonly documentReviewService: DocumentReviewService) {
    super();
  }

  async process(
    job: Job<DocumentReviewJobData>,
    _token?: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { documentId, workspaceId, force } = job.data;
    this.logger.log(
      `[document-review] start documentId=${documentId} workspaceId=${workspaceId} force=${force ?? false}`,
    );
    try {
      const review = await this.documentReviewService.runReview({
        documentId,
        workspaceId,
        force,
        signal,
      });
      this.logger.log(
        `[document-review] done documentId=${documentId} reviewId=${review.id} status=${review.status} ` +
          `issues={blocker:${review.issueCounts.blocker},high:${review.issueCounts.high},` +
          `medium:${review.issueCounts.medium},low:${review.issueCounts.low}} durationMs=${review.durationMs}`,
      );
    } catch (err) {
      this.logger.error(
        `[document-review] FAILED documentId=${documentId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }
}
