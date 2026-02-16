import {
  Controller,
  Get,
  Put,
  Body,
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
  WorkspaceSettingsConfig,
  UpdateWorkspaceSettingsRequest,
} from '@contractai-review/shared';
import { WorkspaceSettingsService } from './workspace-settings.service';

@Controller('workspaces/:workspaceId/settings')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
export class WorkspaceSettingsController {
  constructor(
    private readonly workspaceSettingsService: WorkspaceSettingsService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getSettings(
    @WorkspaceId() workspaceId: string,
  ): Promise<WorkspaceSettingsConfig> {
    return this.workspaceSettingsService.getSettings(workspaceId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateSettings(
    @WorkspaceId() workspaceId: string,
    @Body() config: UpdateWorkspaceSettingsRequest,
  ): Promise<WorkspaceSettingsConfig> {
    return this.workspaceSettingsService.updateSettings(workspaceId, config);
  }
}
