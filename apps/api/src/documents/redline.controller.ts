import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { VersionService } from './version.service';

export enum RedlinePlaybook {
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  CLIENT_FRIENDLY = 'client-friendly',
}

export interface RedlineRequest {
  playbook: RedlinePlaybook;
  instructions?: string; // Optional custom instructions
}

export interface RedlineResponse {
  versionId: string;
  changes: Array<{
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
  playbook: RedlinePlaybook;
  createdAt: Date;
}

@Controller('workspaces/:workspaceId/documents/:documentId/redline')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
export class RedlineController {
  constructor(
    private documentsService: DocumentsService,
    private auditService: AuditService,
    private versionService: VersionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async generateRedline(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body() redlineDto: RedlineRequest,
  ): Promise<RedlineResponse> {
    // Verify document exists and belongs to workspace
    const document = await this.documentsService.findById(documentId, workspaceId);

    // TODO: Implement redline generation logic
    // For now, return a placeholder response
    // This will be fully implemented in Fase 10
    const changes: Array<{
      section: string;
      original: string;
      suggested: string;
      reason: string;
    }> = []; // Empty for now, will be populated in Fase 10

    const playbook = redlineDto.playbook || RedlinePlaybook.BALANCED;
    
    // Create version (respects no-logs configuration)
    const version = await this.versionService.createVersion(
      documentId,
      workspaceId,
      user.id,
      playbook,
      changes,
      redlineDto.instructions,
      undefined, // prompt will be added in Fase 10
    );
    
    const response: RedlineResponse = {
      versionId: version.id,
      changes,
      playbook,
      createdAt: version.createdAt,
    };
    
    // Log redline generation
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.REDLINE_GENERATE,
      TargetType.DOCUMENT,
      documentId,
      requestInfo.ip,
      requestInfo.userAgent,
      { playbook: response.playbook, changesCount: response.changes.length },
    );
    
    return response;
  }
}
