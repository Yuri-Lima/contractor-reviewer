import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from '../workspace/decorators';
import { PrivacyService } from './privacy.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';

@Controller('workspaces/:workspaceId/privacy')
@UseGuards(JwtAuthGuard, WorkspaceGuard)
export class PrivacyController {
  constructor(
    private privacyService: PrivacyService,
    private auditService: AuditService,
  ) {}

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER, WorkspaceRole.VIEWER)
  async exportPrivacyData(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
    @Res() res: Response,
  ): Promise<void> {
    const exportData = await this.privacyService.exportPrivacyData(workspaceId, user.id);

    // Log export action
    await this.auditService.createAuditLog(
      workspaceId,
      user.id,
      AuditAction.EXPORT_PRIVACY,
      TargetType.WORKSPACE,
      workspaceId,
      requestInfo.ip,
      requestInfo.userAgent,
      {
        chatMessagesCount: exportData.chatMessages?.length || 0,
        versionsCount: exportData.versions?.length || 0,
        auditLogsCount: exportData.auditLogs?.length || 0,
      },
    );

    // Set headers for JSON download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="privacy-export-${workspaceId}-${Date.now()}.json"`);

    res.json(exportData);
  }

  @Post('no-logs')
  @UseGuards(RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleNoLogs(
    @WorkspaceId() workspaceId: string,
    @Body() toggleDto: {
      enabled: boolean;
      config?: {
        skipDocumentContent?: boolean;
        skipChatMessages?: boolean;
        skipVersions?: boolean;
        acceleratedPurgeDays?: number;
      };
    },
  ): Promise<{ enabled: boolean; config?: any }> {
    await this.privacyService.toggleNoLogs(
      workspaceId,
      toggleDto.enabled,
      toggleDto.config,
    );
    return { enabled: toggleDto.enabled, config: toggleDto.config };
  }
}
