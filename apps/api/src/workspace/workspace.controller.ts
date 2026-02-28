import {
  Controller,
  Post,
  Get,
  Patch,
  Put,
  Delete,
  Body,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
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
import { AssetManagerService } from '../asset-manager/asset-manager.service';
import { ReqAbortSignal } from '../common/decorators/req-abort-signal.decorator';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private workspaceService: WorkspaceService,
    private auditService: AuditService,
    private assetManagerService: AssetManagerService,
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

  @Patch(':workspaceId')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  async updateWorkspace(
    @WorkspaceId() workspaceId: string,
    @Body() updateDto: { name: string },
  ): Promise<Workspace> {
    const name = updateDto?.name?.trim();
    if (!name) {
      throw new BadRequestException('Workspace name is required');
    }
    return this.workspaceService.updateName(workspaceId, name);
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

  @Post(':workspaceId/members/invite')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async inviteMember(
    @WorkspaceId() workspaceId: string,
    @Body()
    inviteDto: {
      email: string;
      name?: string;
      password?: string;
      role: WorkspaceRole;
    },
    @CurrentUser() currentUser: { id: string },
    @RequestInfo() requestInfo: { ip: string; userAgent: string },
  ): Promise<WorkspaceMember> {
    const member = await this.workspaceService.inviteMember(
      workspaceId,
      inviteDto,
    );
    await this.auditService.createAuditLog(
      workspaceId,
      currentUser.id,
      AuditAction.MEMBER_ADD,
      TargetType.USER,
      member.userId,
      requestInfo.ip,
      requestInfo.userAgent,
      { addedUserId: member.userId, role: inviteDto.role },
    );
    return member;
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

  @Get(':workspaceId/logo/url')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  async getWorkspaceLogoUrl(@WorkspaceId() workspaceId: string): Promise<{ url: string }> {
    const url = await this.assetManagerService.getImageUrl(
      'workspace_logo',
      workspaceId,
      'original',
      3600,
    );
    return { url };
  }

  @Post(':workspaceId/logo')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async uploadWorkspaceLogo(
    @WorkspaceId() workspaceId: string,
    @UploadedFile() file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    @ReqAbortSignal() signal: AbortSignal,
  ): Promise<void> {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    await this.assetManagerService.uploadImage('workspace_logo', workspaceId, file, { signal });
  }

  @Get(':workspaceId/logo')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER, WorkspaceRole.VIEWER)
  async getWorkspaceLogo(
    @WorkspaceId() workspaceId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const { buffer, mimeType } = await this.assetManagerService.getImageBuffer(
        'workspace_logo',
        workspaceId,
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(buffer);
    } catch {
      res.status(404).send();
    }
  }

  @Delete(':workspaceId/logo')
  @UseGuards(WorkspaceGuard, RolesGuard)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkspaceLogo(@WorkspaceId() workspaceId: string): Promise<void> {
    await this.assetManagerService.deleteImage('workspace_logo', workspaceId);
  }
}
