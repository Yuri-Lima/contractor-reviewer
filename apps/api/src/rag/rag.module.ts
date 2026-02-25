import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfParserService } from './pdf-parser.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingsService } from './embeddings.service';
import { RagService } from './rag.service';
import { JurisdictionResolverService } from './jurisdiction-resolver.service';
import { OcrService } from './ocr.service';
import { Document } from '../entities/document.entity';
import { StorageModule } from '../storage/storage.module';
import { ConfigModule } from '@nestjs/config';
import { PromptsModule } from '../prompts/prompts.module';
import { VectorStoreModule } from '../vector-store/vector-store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    VectorStoreModule,
    StorageModule,
    ConfigModule,
    PromptsModule,
  ],
  providers: [
    PdfParserService,
    ChunkingService,
    EmbeddingsService,
    RagService,
    JurisdictionResolverService,
    OcrService,
  ],
  exports: [
    VectorStoreModule,
    PdfParserService,
    ChunkingService,
    EmbeddingsService,
    RagService,
    JurisdictionResolverService,
    OcrService,
  ],
})
export class RagModule {}
