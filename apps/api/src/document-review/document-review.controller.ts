import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { CurrentUser, WorkspaceId } from '../workspace/decorators';
import { RequestInfo } from '../common/decorators/request-info.decorator';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { DocumentReviewService } from './document-review.service';
import type { DocumentReview } from '../entities/document-review.entity';
import type { DocumentReviewJobData } from '../workers/document-review.processor';

/**
 * Phase 4 endpoints:
 *   GET  /workspaces/:workspaceId/documents/:documentId/review
 *        — returns the latest persisted review (404 when none yet).
 *   POST /workspaces/:workspaceId/documents/:documentId/review/rerun
 *        — enqueues a fresh review run; returns 202 with the queued job id.
 */
@Controller('workspaces/:workspaceId/documents/:documentId/review')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class DocumentReviewController {
  constructor(
    private readonly reviewService: DocumentReviewService,
    private readonly auditService: AuditService,
    @InjectQueue('document-review')
    private readonly queue: Queue<DocumentReviewJobData>,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    WorkspaceRole.VIEWER,
    WorkspaceRole.MEMBER,
    WorkspaceRole.ADMIN,
    WorkspaceRole.OWNER,
  )
  async getReview(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
  ): Promise<DocumentReview> {
    const review = await this.reviewService.getLatest(documentId, workspaceId);
    if (!review) {
      throw new NotFoundException('No review yet — POST /rerun to create one.');
    }
    return review;
  }

  @Post('rerun')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.ACCEPTED)
  async rerunReview(
    @WorkspaceId() workspaceId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<{ queued: true; jobId: string | undefined }> {
    const job = await this.queue.add('rerun', {
      documentId,
      workspaceId,
      force: true,
    });
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.DOCUMENT_REVIEW_GENERATED,
      TargetType.DOCUMENT,
      documentId,
      requestInfo.ip,
      requestInfo.userAgent,
      { trigger: 'rerun', jobId: job.id ?? null },
    );
    return { queued: true, jobId: job.id?.toString() };
  }
}
