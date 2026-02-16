import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceSettingsController } from './workspace-settings.controller';
import { WorkspaceSettingsService } from './workspace-settings.service';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { WorkspaceGuard, RolesGuard } from './guards';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceSettings])],
  controllers: [WorkspaceController, WorkspaceSettingsController],
  providers: [WorkspaceService, WorkspaceSettingsService, WorkspaceGuard, RolesGuard],
  exports: [WorkspaceService, WorkspaceSettingsService, WorkspaceGuard, RolesGuard],
})
export class WorkspaceModule {}
