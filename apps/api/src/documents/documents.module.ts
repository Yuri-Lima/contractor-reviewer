import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { ChatController } from './chat.controller';
import { RedlineController } from './redline.controller';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentJob } from '../entities/document-job.entity';
import { Chunk } from '../entities/chunk.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RagModule } from '../rag/rag.module';
import { AuditModule } from '../audit/audit.module';
import { ChatMessageService } from './chat-message.service';
import { VersionService } from './version.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Document,
      DocumentFile,
      DocumentJob,
      Chunk,
      ChatMessage,
      DocumentVersion,
      WorkspaceSettings,
    ]),
    StorageModule,
    QueueModule,
    WorkspaceModule,
    RagModule,
    AuditModule, // For audit logging
  ],
  controllers: [DocumentsController, ChatController, RedlineController],
  providers: [DocumentsService, ChatMessageService, VersionService],
  exports: [DocumentsService, ChatMessageService, VersionService],
})
export class DocumentsModule {}
