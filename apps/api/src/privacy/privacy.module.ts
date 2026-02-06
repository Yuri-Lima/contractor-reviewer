import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { Document } from '../entities/document.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { DocumentJob } from '../entities/document-job.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { DocumentVersion } from '../entities/document-version.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceSettings,
      Document,
      DocumentFile,
      DocumentJob,
      AuditLog,
      ChatMessage,
      DocumentVersion,
    ]),
    WorkspaceModule, // Required for WorkspaceGuard
    AuditModule, // For audit logging
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
