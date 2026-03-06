import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { JurisdictionEvaluationService } from '../rag/jurisdiction-evaluation.service';
import { RagCacheService } from '../cache/rag-cache.service';
import { JurisdictionStatus } from '@contractai-review/shared';

interface JurisdictionEvaluationJobData {
  documentId: string;
  workspaceId?: string;
}

@Processor('jurisdiction-evaluation', {
  stalledInterval: 30000,
  maxStalledCount: 1,
})
@Injectable()
export class JurisdictionEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(JurisdictionEvaluationProcessor.name);

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    private jurisdictionEvaluationService: JurisdictionEvaluationService,
    private ragCacheService: RagCacheService,
  ) {
    super();
  }

  async process(job: Job<JurisdictionEvaluationJobData>): Promise<void> {
    const { documentId, workspaceId } = job.data;

    this.logger.log(`[Jurisdiction] Processing job for documentId=${documentId}`);

    const result = await this.jurisdictionEvaluationService.evaluateFromAllFiles(
      documentId,
      workspaceId,
    );

    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      this.logger.warn(`[Jurisdiction] Document not found: documentId=${documentId}`);
      return;
    }

    document.resolvedJurisdiction = result.resolvedJurisdiction;
    document.jurisdictionStatus = result.jurisdictionStatus as JurisdictionStatus;
    document.jurisdictionCandidates = result.jurisdictionCandidates;
    document.jurisdictionReasoning = result.jurisdictionReasoning ?? null;
    await this.documentRepository.save(document);

    await this.ragCacheService.invalidateDocument(documentId);

    this.logger.log(
      `[Jurisdiction] Completed: documentId=${documentId} resolved=${result.resolvedJurisdiction}`,
    );
  }
}
