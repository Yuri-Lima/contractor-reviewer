import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfParserService } from './pdf-parser.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingsService } from './embeddings.service';
import { RagService } from './rag.service';
import { JurisdictionResolverService } from './jurisdiction-resolver.service';
import { OcrService } from './ocr.service';
import { Chunk } from '../entities/chunk.entity';
import { Embedding } from '../entities/embedding.entity';
import { Document } from '../entities/document.entity';
import { StorageModule } from '../storage/storage.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chunk, Embedding, Document]),
    StorageModule,
    ConfigModule,
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
    PdfParserService,
    ChunkingService,
    EmbeddingsService,
    RagService,
    JurisdictionResolverService,
    OcrService,
  ],
})
export class RagModule {}
