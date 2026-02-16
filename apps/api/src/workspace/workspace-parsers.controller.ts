import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspaceGuard, RolesGuard } from './guards';
import { Roles } from './decorators/roles.decorator';
import { WorkspaceRole } from '../entities/workspace-member.entity';
import { WorkspaceId } from './decorators';
import { ParserInfo } from '@contractai-review/shared';
import { ParserFactoryService } from '../parsers/parser-factory.service';

@Controller('workspaces/:workspaceId/document-parsers')
@UseGuards(JwtAuthGuard, WorkspaceGuard, RolesGuard)
@Roles(WorkspaceRole.VIEWER, WorkspaceRole.MEMBER, WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
export class WorkspaceParsersController {
  constructor(private readonly parserFactory: ParserFactoryService) {}

  @Get()
  async listParsers(@WorkspaceId() workspaceId: string): Promise<ParserInfo[]> {
    return this.parserFactory.listParsers(workspaceId);
  }
}
