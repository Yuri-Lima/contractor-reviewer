import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceSettingsController } from './workspace-settings.controller';
import { WorkspaceParsersController } from './workspace-parsers.controller';
import { WorkspaceSettingsService } from './workspace-settings.service';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceMember } from '../entities/workspace-member.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { WorkspaceGuard, RolesGuard } from './guards';
import { ParsersModule } from '../parsers/parsers.module';
import { AuditModule } from '../audit/audit.module';
import { AssetManagerModule } from '../asset-manager/asset-manager.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workspace, WorkspaceMember, WorkspaceSettings]),
    forwardRef(() => ParsersModule),
    forwardRef(() => AuditModule),
    AssetManagerModule,
  ],
  controllers: [WorkspaceController, WorkspaceSettingsController, WorkspaceParsersController],
  providers: [WorkspaceService, WorkspaceSettingsService, WorkspaceGuard, RolesGuard],
  exports: [WorkspaceService, WorkspaceSettingsService, WorkspaceGuard, RolesGuard],
})
export class WorkspaceModule {}
