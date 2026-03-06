import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { ChatController } from './chat.controller';
import { RedlineController } from './redline.controller';
import { DocumentPromptsController } from './document-prompts.controller';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentJob } from '../entities/document-job.entity';
import { ChatThread } from '../entities/chat-thread.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { FileTypeModule } from '../file-type/file-type.module';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RagModule } from '../rag/rag.module';
import { CacheModule } from '../cache/cache.module';
import { PromptsModule } from '../prompts/prompts.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { TtsModule } from '../tts/tts.module';
import { ChatThreadService } from './chat-thread.service';
import { ChatMessageService } from './chat-message.service';
import { VersionService } from './version.service';
import { RedlineService } from './redline.service';
import { DiffService } from './diff.service';
import { DocumentDeletionOrchestrator } from './document-deletion.orchestrator';
import { Embedding } from '../entities/embedding.entity';
import { ChunksModule } from '../chunks/chunks.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentFile,
      DocumentJob,
      ChatThread,
      ChatMessage,
      DocumentVersion,
      WorkspaceSettings,
      Embedding,
    ]),
    ChunksModule,
    FileTypeModule,
    StorageModule,
    QueueModule,
    WorkspaceModule,
    RagModule,
    CacheModule,
    PromptsModule,
    AuditModule,
    AuthModule,
    MemoryModule,
    TranscriptionModule,
    TtsModule,
  ],
  controllers: [
    DocumentsController,
    ChatController,
    RedlineController,
    DocumentPromptsController,
  ],
  providers: [
    DocumentsService,
    ChatThreadService,
    ChatMessageService,
    VersionService,
    RedlineService,
    DiffService,
    DocumentDeletionOrchestrator,
  ],
  exports: [
    DocumentsService,
    ChatThreadService,
    ChatMessageService,
    VersionService,
    RedlineService,
    DiffService,
  ],
})
export class DocumentsModule {}
