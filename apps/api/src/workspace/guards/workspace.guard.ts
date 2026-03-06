import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { WorkspaceService } from '../workspace.service';

@Injectable()
export class WorkspaceGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceGuard.name);

  constructor(private workspaceService: WorkspaceService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params.workspaceId || request.params.id;
    const user = request.user;

    if (!workspaceId) {
      throw new NotFoundException('Workspace ID is required');
    }

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Verify workspace exists
    await this.workspaceService.findById(workspaceId);

    // Verify user is a member
    const membership = await this.workspaceService.verifyMembership(workspaceId, user.id);

    // Attach workspace and membership to request for use in controllers
    request.workspaceId = workspaceId;
    request.workspaceMembership = membership;

    this.logger.debug('[WorkspaceGuard] Access granted', {
      workspaceId,
      userId: user.id,
      role: membership.role,
    });
    return true;
  }
}
