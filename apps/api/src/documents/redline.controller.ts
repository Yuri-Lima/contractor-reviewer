import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import {
  RedlinePlaybook,
  RedlineRequest,
  RedlineResponse,
} from '@contractai-review/shared';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { DocumentsService } from './documents.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { ReqAbortSignal } from '../common/decorators/req-abort-signal.decorator';
import { VersionService } from './version.service';
import { RedlineService } from './redline.service';
import { DiffService } from './diff.service';

@Controller('workspaces/:workspaceId/documents/:documentId/redline')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
export class RedlineController {
  private readonly logger = new Logger(RedlineController.name);

  constructor(
    private documentsService: DocumentsService,
    private auditService: AuditService,
    private versionService: VersionService,
    private redlineService: RedlineService,
    private diffService: DiffService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async generateRedline(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body() redlineDto: RedlineRequest,
    @ReqAbortSignal() signal: AbortSignal,
  ): Promise<RedlineResponse> {
    // Verify document exists and belongs to workspace
    await this.documentsService.findById(documentId, workspaceId);

    this.logger.log('[GenerateRedline] Request', {
      documentId,
      workspaceId,
      playbook: redlineDto.playbook || RedlinePlaybook.BALANCED,
      selectedTextLength: redlineDto.selectedText?.length ?? 0,
      pageNumber: redlineDto.pageNumber,
    });

    if (!redlineDto.selectedText || !redlineDto.selectedText.trim()) {
      throw new Error('selectedText is required');
    }

    const playbook = redlineDto.playbook || RedlinePlaybook.BALANCED;

    // Generate redline using AI + RAG
    const redlineChange = await this.redlineService.generateRedline(
      redlineDto.selectedText.trim(),
      documentId,
      workspaceId,
      playbook,
      redlineDto.instructions,
      redlineDto.objective,
      redlineDto.pageNumber,
      redlineDto.spanId,
      redlineDto.language || 'en', // Pass language, default to 'en'
      { signal },
    );

    // Create version (respects no-logs configuration)
    const version = await this.versionService.createVersion(
      documentId,
      workspaceId,
      user.id,
      playbook,
      [redlineChange],
      redlineDto.instructions,
      undefined, // prompt can be added later if needed
    );

    const response: RedlineResponse = {
      versionId: version.id,
      changes: [redlineChange],
      playbook,
      createdAt: version.createdAt.toISOString(),
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
      {
        playbook: response.playbook,
        changesCount: response.changes.length,
        versionId: version.id,
      },
    );

    return response;
  }

  @Post(':versionId/apply')
  @HttpCode(HttpStatus.OK)
  async applyRedline(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Body() body: {
      decisions?: Array<{ blockId: string; decision: 'accept' | 'reject' }>;
      finalText?: string;
    },
  ) {
    // Validate that at least one of decisions or finalText is provided
    if (!body.decisions && !body.finalText) {
      throw new Error('Either decisions or finalText must be provided');
    }

    this.logger.log('[ApplyRedline] Request', {
      documentId,
      versionId,
      decisionsCount: body.decisions?.length ?? 0,
      manuallyEdited: !!body.finalText && !body.decisions,
    });

    // Verify document exists
    await this.documentsService.findById(documentId, workspaceId);

    // Get the version
    const version = await this.versionService.getVersionById(versionId, documentId, workspaceId);

    if (!version || !version.changes || version.changes.length === 0) {
      throw new Error('Version not found or has no changes');
    }

    const change = version.changes[0];
    let finalText: string;
    let decisionsArray: Array<{ blockId: string; decision: 'accept' | 'reject' }> | undefined;

    if (body.finalText) {
      // Use provided finalText directly (manually edited)
      finalText = body.finalText;
      decisionsArray = body.decisions; // May be undefined if only finalText provided
    } else if (body.decisions) {
      // Use existing logic with decisions
      const originalText = change.originalText;
      const diffBlocks = change.diffBlocks;
      finalText = this.diffService.applyDecisions(originalText, diffBlocks, body.decisions);
      decisionsArray = body.decisions;
    } else {
      throw new Error('Either decisions or finalText must be provided');
    }

    // Create new version
    const newVersion = await this.versionService.applyVersion(
      versionId,
      documentId,
      workspaceId,
      user.id,
      decisionsArray || [],
      finalText,
    );

    // Log redline apply
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.REDLINE_APPLY,
      TargetType.VERSION,
      newVersion.id,
      requestInfo.ip,
      requestInfo.userAgent,
      {
        parentVersionId: versionId,
        newVersionId: newVersion.id,
        versionNumber: newVersion.versionNumber,
        decisionsCount: decisionsArray?.length || 0,
        manuallyEdited: !!body.finalText && !body.decisions,
      },
    );

    return {
      versionId: newVersion.id,
      versionNumber: newVersion.versionNumber,
      finalText,
      createdAt: newVersion.createdAt,
    };
  }
}
