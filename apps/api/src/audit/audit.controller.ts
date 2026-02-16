import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from '../workspace/guards';
import { Roles } from '../workspace/decorators/roles.decorator';
import { AuditLogQueryDto, AuditLog } from '@contractai-review/shared';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId } from '../workspace/decorators';
import { AuditService } from './audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';

@Controller('workspaces/:workspaceId/audit')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAuditLogs(
    @WorkspaceId() workspaceId: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<{
    logs: AuditLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    return this.auditService.getAuditLogs(workspaceId, query);
  }
}
