import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { WorkspaceGuard, RolesGuard } from './guards';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceSettings])],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceGuard, RolesGuard],
  exports: [WorkspaceService, WorkspaceGuard, RolesGuard],
})
export class WorkspaceModule {}
