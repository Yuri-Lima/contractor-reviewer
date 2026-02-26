import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from './guards';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId } from './decorators';
import {
  WorkspaceSettingsGetResponse,
  UpdateWorkspaceSettingsRequest,
} from '@contractai-review/shared';
import { WorkspaceSettingsService } from './workspace-settings.service';

@Controller('workspaces/:workspaceId/settings')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
export class WorkspaceSettingsController {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  @Get()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getSettings(
    @WorkspaceId() workspaceId: string,
    @Req() req: { workspaceMembership?: { role: WorkspaceRole } },
  ): Promise<WorkspaceSettingsGetResponse> {
    const config = await this.workspaceSettingsService.getSettings(workspaceId);
    const currentUserRole =
      req.workspaceMembership?.role ?? WorkspaceRole.VIEWER;
    return { ...config, currentUserRole };
  }

  @Put()
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @WorkspaceId() workspaceId: string,
    @Body() config: UpdateWorkspaceSettingsRequest,
    @Req() req: { workspaceMembership?: { role: WorkspaceRole } },
  ): Promise<WorkspaceSettingsGetResponse> {
    const updated = await this.workspaceSettingsService.updateSettings(
      workspaceId,
      config,
    );
    const currentUserRole =
      req.workspaceMembership?.role ?? WorkspaceRole.ADMIN;
    return { ...updated, currentUserRole };
  }
}
