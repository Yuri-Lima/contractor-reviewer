import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentReview } from '../entities/document-review.entity';
import { DocumentReviewService } from './document-review.service';
import { DocumentReviewController } from './document-review.controller';
import { LlmDetectorService } from './llm-detector.service';
import { MergeService } from './merge.service';
import { RuleDetectorService } from './rules/rule-detector.service';
import { RuleLoaderService } from './rules/rule-loader.service';
import { LlmModule } from '../llm/llm.module';
import { RagModule } from '../rag/rag.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentFile, DocumentReview]),
    BullModule.registerQueue({ name: 'document-review' }),
    LlmModule,
    RagModule,
    AuditModule,
    AuthModule,
    WorkspaceModule,
    QueueModule,
  ],
  controllers: [DocumentReviewController],
  providers: [
    DocumentReviewService,
    LlmDetectorService,
    MergeService,
    RuleDetectorService,
    RuleLoaderService,
  ],
  exports: [DocumentReviewService, RuleLoaderService],
})
export class DocumentReviewModule {}
