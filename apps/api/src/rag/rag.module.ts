import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfParserService } from './pdf-parser.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingsService } from './embeddings.service';
import { RagService } from './rag.service';
import { JurisdictionResolverService } from './jurisdiction-resolver.service';
import { JurisdictionEvaluationService } from './jurisdiction-evaluation.service';
import { ChatPrepareCacheService } from './chat-prepare-cache.service';
import { LegalReviewModelResolver } from './legal-review-model-resolver.service';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { StorageModule } from '../storage/storage.module';
import { ConfigModule } from '@nestjs/config';
import { PromptsModule } from '../prompts/prompts.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CacheModule } from '../cache/cache.module';
import { LlmModule } from '../llm/llm.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentFile]),
    VectorStoreModule,
    StorageModule,
    ConfigModule,
    PromptsModule,
    WorkspaceModule,
    CacheModule,
    LlmModule,
    MemoryModule,
  ],
  providers: [
    PdfParserService,
    ChunkingService,
    EmbeddingsService,
    RagService,
    JurisdictionResolverService,
    JurisdictionEvaluationService,
    ChatPrepareCacheService,
    LegalReviewModelResolver,
  ],
  exports: [
    VectorStoreModule,
    PdfParserService,
    ChunkingService,
    EmbeddingsService,
    RagService,
    JurisdictionResolverService,
    JurisdictionEvaluationService,
    LegalReviewModelResolver,
  ],
})
export class RagModule {}
