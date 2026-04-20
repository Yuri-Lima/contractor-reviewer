import type { Job } from 'bullmq';
import {
  DocumentReviewProcessor,
  type DocumentReviewJobData,
} from './document-review.processor';
import type { DocumentReviewService } from '../document-review/document-review.service';
import type { DocumentReview } from '../entities/document-review.entity';

/**
 * Specs for the BullMQ processor that runs persistent document reviews.
 *
 * The processor is intentionally thin: orchestration (idempotency, persistence,
 * status, error reporting) lives in `DocumentReviewService.runReview` and is
 * covered by its own integration. Here we just guarantee:
 *   - the job payload (documentId / workspaceId / force) is forwarded as-is;
 *   - the AbortSignal threaded by BullMQ is passed through;
 *   - errors thrown by the service propagate so BullMQ can retry / fail the job.
 */
describe('DocumentReviewProcessor', () => {
  let processor: DocumentReviewProcessor;
  let runReview: jest.Mock;
  let service: DocumentReviewService;

  const buildReview = (
    overrides: Partial<DocumentReview> = {},
  ): DocumentReview => ({
    id: 'review-1',
    documentId: 'doc-1',
    rulesVersion: 'v1',
    llmModel: 'gpt-4o',
    status: 'succeeded',
    durationMs: 1234,
    issueCounts: { blocker: 0, high: 1, medium: 2, low: 0, info: 0 },
    issues: [],
    compliantElements: [],
    legislationReferenced: [],
    recommendations: [],
    ...overrides,
  } as unknown as DocumentReview);

  const buildJob = (
    data: DocumentReviewJobData,
  ): Job<DocumentReviewJobData> =>
    ({
      data,
    }) as unknown as Job<DocumentReviewJobData>;

  beforeEach(() => {
    runReview = jest.fn();
    service = { runReview } as unknown as DocumentReviewService;
    processor = new DocumentReviewProcessor(service);
  });

  it('forwards documentId, workspaceId, force and signal to the service', async () => {
    runReview.mockResolvedValue(buildReview());
    const signal = new AbortController().signal;

    await processor.process(
      buildJob({ documentId: 'doc-1', workspaceId: 'ws-1', force: true }),
      undefined,
      signal,
    );

    expect(runReview).toHaveBeenCalledTimes(1);
    expect(runReview).toHaveBeenCalledWith({
      documentId: 'doc-1',
      workspaceId: 'ws-1',
      force: true,
      signal,
    });
  });

  it('treats missing force as undefined (idempotent rerun is the default)', async () => {
    runReview.mockResolvedValue(buildReview());
    await processor.process(
      buildJob({ documentId: 'doc-2', workspaceId: 'ws-2' }),
    );
    const args = runReview.mock.calls[0][0];
    expect(args.force).toBeUndefined();
  });

  it('rethrows service errors so BullMQ can mark the job as failed', async () => {
    const boom = new Error('downstream failure');
    runReview.mockRejectedValue(boom);
    await expect(
      processor.process(
        buildJob({ documentId: 'doc-3', workspaceId: 'ws-3' }),
      ),
    ).rejects.toBe(boom);
  });

  it('returns void on success (BullMQ contract)', async () => {
    runReview.mockResolvedValue(
      buildReview({
        status: 'degraded',
        issueCounts: { blocker: 1, high: 0, medium: 0, low: 0, info: 0 },
      }),
    );
    const result = await processor.process(
      buildJob({ documentId: 'doc-4', workspaceId: 'ws-4' }),
    );
    expect(result).toBeUndefined();
  });
});
