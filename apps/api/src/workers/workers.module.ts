import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParsingProcessor } from './parsing.processor';
import { ChunkingProcessor } from './chunking.processor';
import { EmbeddingsProcessor } from './embeddings.processor';
import { OcrProcessor } from './ocr.processor';
import { DocumentJob } from '../entities/document-job.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { Document } from '../entities/document.entity';
import { Chunk } from '../entities/chunk.entity';
import { StorageModule } from '../storage/storage.module';
import { RagModule } from '../rag/rag.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentJob, DocumentFile, Document, Chunk]),
    StorageModule,
    RagModule,
    QueueModule,
  ],
  providers: [ParsingProcessor, ChunkingProcessor, EmbeddingsProcessor, OcrProcessor],
})
export class WorkersModule {}
