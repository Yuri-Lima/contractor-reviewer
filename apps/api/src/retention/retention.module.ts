import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetentionService } from './retention.service';
import { PurgeService } from './purge.service';
import { PurgeScheduler } from './purge.scheduler';
import { RetentionController } from './retention.controller';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { Document } from '../entities/document.entity';
import { ChatThread } from '../entities/chat-thread.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { Memory } from '../entities/memory.entity';
import { ChunksModule } from '../chunks/chunks.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceModule } from '../workspace/workspace.module';

// Detect if running as worker (scheduled jobs should only run in API server)
const isWorker =
  typeof require !== 'undefined' &&
  require.main &&
  (require.main.filename?.includes('worker') ||
    process.argv[1]?.includes('worker') ||
    process.argv[1]?.includes('dist/worker'));

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceSettings,
      DocumentFile,
      Document,
      ChatThread,
      ChatMessage,
      Memory,
    ]),
    ChunksModule,
    // ScheduleModule is imported in AppModule, not here to avoid duplication
    StorageModule, // For file deletion
    WorkspaceModule, // Required for WorkspaceGuard
  ],
  controllers: [RetentionController],
  // Only register PurgeScheduler in API server, not in worker
  providers: [
    RetentionService,
    PurgeService,
    ...(isWorker ? [] : [PurgeScheduler]),
  ],
  exports: [RetentionService, PurgeService],
})
export class RetentionModule {}
