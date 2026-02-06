import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuditLog]),
    WorkspaceModule, // Required for WorkspaceGuard
  ],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService], // Export so other modules can use AuditService
})
export class AuditModule {}
