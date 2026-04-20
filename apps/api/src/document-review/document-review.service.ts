import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, IsNull, Repository } from 'typeorm';
import type {
  CompliantElement,
  LegalIssue,
  LegislationReference,
} from '@contractai-review/shared';
import { sortIssuesBySeverity } from '@contractai-review/shared';
import { Document } from '../entities/document.entity';
import { DocumentFile, FileStatus } from '../entities/document-file.entity';
import { DocumentReview } from '../entities/document-review.entity';
import { RuleDetectorService } from './rules/rule-detector.service';
import { RuleLoaderService } from './rules/rule-loader.service';
import { LlmDetectorService } from './llm-detector.service';
import { MergeService } from './merge.service';

interface RunReviewOptions {
  workspaceId: string;
  documentId: string;
  signal?: AbortSignal;
  /** When true, ignore an existing identical-key review and recompute. */
  force?: boolean;
}

@Injectable()
export class DocumentReviewService {
  private readonly logger = new Logger(DocumentReviewService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(DocumentFile)
    private readonly fileRepo: Repository<DocumentFile>,
    @InjectRepository(DocumentReview)
    private readonly reviewRepo: Repository<DocumentReview>,
    private readonly ruleDetector: RuleDetectorService,
    private readonly ruleLoader: RuleLoaderService,
    private readonly llmDetector: LlmDetectorService,
    private readonly mergeService: MergeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get the latest review for a document, or null if none exists yet.
   * Picked by `updatedAt DESC`.
   */
  async getLatest(documentId: string, workspaceId: string): Promise<DocumentReview | null> {
    await this.assertDocumentBelongsToWorkspace(documentId, workspaceId);
    const rows = await this.reviewRepo.find({
      where: { documentId },
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return rows[0] ?? null;
  }

  /**
   * Run (or re-use) a review for a document. Idempotent on
   * (documentId, rulesVersion, llmModel) — re-running with the same key
   * returns the existing row unless `force` is set.
   */
  async runReview(opts: RunReviewOptions): Promise<DocumentReview> {
    await this.assertDocumentBelongsToWorkspace(opts.documentId, opts.workspaceId);

    const document = await this.documentRepo.findOne({
      where: { id: opts.documentId },
      relations: ['files'],
    });
    if (!document) throw new NotFoundException('Document not found');

    const file = (document.files ?? []).find(
      (f) => f.status === FileStatus.AVAILABLE && (f.ocrText?.length ?? 0) > 0,
    );
    if (!file) {
      throw new NotFoundException(
        'Document has no parsed text; parse or re-upload before requesting review.',
      );
    }

    const rulesVersion = this.ruleLoader.getActiveRulesVersion();
    const llmEnabled =
      (this.configService.get<string>('LEGAL_REVIEW_MODE') ?? 'on').toLowerCase() === 'on';

    const startedAt = Date.now();
    const ruleHits = this.ruleDetector.detect(
      {
        text: file.ocrText,
        chunks: [{ text: file.ocrText, clauseNumber: null }],
        jurisdiction: document.resolvedJurisdiction,
      },
      rulesVersion,
    );
    const ruleIssues: LegalIssue[] = ruleHits.map((h) => h.issue);

    let llmIssues: LegalIssue[] = [];
    let llmCompliantElements: CompliantElement[] = [];
    let llmRecommendations: string[] = [];
    let llmLegislationReferenced: LegislationReference[] = [];
    let llmModel: string | null = null;
    let status: DocumentReview['status'] = 'succeeded';
    let errorMessage: string | null = null;

    if (llmEnabled) {
      try {
        const llmResult = await this.llmDetector.detect(file.ocrText, {
          workspaceId: opts.workspaceId,
          jurisdiction: document.resolvedJurisdiction,
          signal: opts.signal,
        });
        llmIssues = llmResult.issues;
        llmCompliantElements = llmResult.compliantElements;
        llmRecommendations = llmResult.recommendations;
        llmLegislationReferenced = llmResult.legislationReferenced;
        llmModel = llmResult.modelUsed;
        if (llmResult.status !== 'succeeded') {
          status = 'degraded';
          errorMessage = llmResult.errorMessage ?? null;
        }
      } catch (err) {
        status = 'degraded';
        errorMessage = (err as Error).message;
        this.logger.warn(`[review] LLM detector failed: ${errorMessage}`);
      }
    }

    // Idempotency: re-use existing row if the (documentId, rulesVersion,
    // llmModel) tuple already has one and `force` is not set.
    if (!opts.force) {
      const existing = await this.reviewRepo.findOne({
        where: {
          documentId: opts.documentId,
          rulesVersion,
          ...(llmModel !== null ? { llmModel } : { llmModel: IsNull() }),
        },
      });
      if (existing) {
        this.logger.log(
          `[review] hit idempotency cache: doc=${opts.documentId} rulesVersion=${rulesVersion} llmModel=${llmModel ?? 'none'}`,
        );
        return existing;
      }
    }

    const allIssues = sortIssuesBySeverity(
      this.mergeService.merge({ ruleIssues, llmIssues }),
    );
    const issueCounts = countSeverities(allIssues);
    const durationMs = Date.now() - startedAt;

    const review: DeepPartial<DocumentReview> = {
      documentId: opts.documentId,
      rulesVersion,
      llmModel,
      issues: allIssues,
      compliantElements: llmCompliantElements,
      recommendations: llmRecommendations,
      legislationReferenced: llmLegislationReferenced,
      issueCounts,
      durationMs,
      status,
      errorMessage,
    };
    const entity = this.reviewRepo.create(review);
    return this.reviewRepo.save(entity);
  }

  private async assertDocumentBelongsToWorkspace(documentId: string, workspaceId: string) {
    const exists = await this.documentRepo.exists({
      where: { id: documentId, workspaceId },
    });
    if (!exists) throw new NotFoundException('Document not found in this workspace');
  }
}

function countSeverities(issues: LegalIssue[]): DocumentReview['issueCounts'] {
  const out = { blocker: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of issues) {
    out[issue.severity] = (out[issue.severity] ?? 0) + 1;
  }
  return out;
}
