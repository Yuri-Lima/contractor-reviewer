import {
  Controller,
  Get,
  Put,
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
import { WorkspaceId } from '../workspace/decorators';
import { RetentionService, RetentionConfig } from './retention.service';

@Controller('workspaces/:workspaceId/retention')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN) // Only OWNER and ADMIN can manage retention
export class RetentionController {
  constructor(private retentionService: RetentionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getRetentionConfig(
    @WorkspaceId() workspaceId: string,
  ): Promise<RetentionConfig> {
    return this.retentionService.getRetentionConfig(workspaceId);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  async updateRetentionConfig(
    @WorkspaceId() workspaceId: string,
    @Body() config: Partial<RetentionConfig>,
  ): Promise<RetentionConfig> {
    return this.retentionService.updateRetentionConfig(workspaceId, config);
  }
}
