import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from './guards';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceService } from './workspace.service';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceId, CurrentUser } from './decorators';
import { AuditService } from '../audit/audit.service';
import { AuditAction, TargetType } from '../entities/audit-log.entity';
import { RequestInfo } from '../common/decorators/request-info.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private workspaceService: WorkspaceService,
    private auditService: AuditService,
  ) {}

  @Get()
  async getWorkspaces(@CurrentUser() user: { id: string }): Promise<Workspace[]> {
    return this.workspaceService.findByUserId(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createWorkspace(
    @Body() createDto: { name: string },
    @CurrentUser() user: { id: string },
  ): Promise<Workspace> {
    return this.workspaceService.create(createDto.name, user.id);
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceGuard)
  async getWorkspace(@WorkspaceId() workspaceId: string): Promise<Workspace> {
    return this.workspaceService.findById(workspaceId);
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkspace(
    @WorkspaceId() workspaceId: string,
    @CurrentUser() user: { id: string },
  ): Promise<void> {
    await this.workspaceService.delete(workspaceId, user.id);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
  async getMembers(
    @WorkspaceId() workspaceId: string,
  ): Promise<WorkspaceMember[]> {
    return this.workspaceService.getMembers(workspaceId);
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @WorkspaceId() workspaceId: string,
    @Body() addMemberDto: { userId: string; role: WorkspaceRole },
    @CurrentUser() currentUser: { id: string },
  ): Promise<WorkspaceMember> {
    return this.workspaceService.addMember(
      workspaceId,
      addMemberDto.userId,
      addMemberDto.role,
    );
  }

  @Put(':workspaceId/members/:userId/role')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER)
  async updateMemberRole(
    @WorkspaceId() workspaceId: string,
    @Param('userId') userId: string,
    @Body() updateRoleDto: { role: WorkspaceRole },
    @CurrentUser() currentUser: { id: string },
  ): Promise<WorkspaceMember> {
    return this.workspaceService.updateMemberRole(
      workspaceId,
      userId,
      updateRoleDto.role,
      currentUser.id,
    );
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @WorkspaceId() workspaceId: string,
    @Param('userId') userId: string,
    @CurrentUser() currentUser: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<void> {
    await this.workspaceService.removeMember(workspaceId, userId, currentUser.id);
    await this.auditService.createAuditLog(
      workspaceId,
      currentUser.id,
      AuditAction.MEMBER_REMOVE,
      TargetType.USER,
      userId,
      requestInfo.ip,
      requestInfo.userAgent,
      { removedUserId: userId },
    );
  }
}
