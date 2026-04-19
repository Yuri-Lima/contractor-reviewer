import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AuditModule } from '../audit/audit.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    MemoryModule,
    TypeOrmModule.forFeature([
      WorkspaceSettings,
      AuditLog,
      ChatMessage,
    ]),
    WorkspaceModule, // Required for WorkspaceGuard
    AuditModule, // For audit logging
  ],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
