import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceService } from '../workspace.service';
import { WorkspaceRole } from '../../entities/workspace-member.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private workspaceService: WorkspaceService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, allow access (workspace membership already verified by WorkspaceGuard)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const workspaceId = request.workspaceId || request.params.workspaceId || request.params.id;
    const user = request.user;

    if (!workspaceId || !user?.id) {
      throw new ForbiddenException('Workspace and user context required');
    }

    // Get user's role in workspace
    const userRole = await this.workspaceService.getUserRole(workspaceId, user.id);

    if (!userRole) {
      throw new ForbiddenException('User is not a member of this workspace');
    }

    // Check if user has any of the required roles
    // Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
    const roleHierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.MEMBER]: 2,
      [WorkspaceRole.VIEWER]: 1,
    };

    const userRoleLevel = roleHierarchy[userRole];
    const hasRequiredRole = requiredRoles.some(
      (requiredRole) => userRoleLevel >= roleHierarchy[requiredRole],
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Required role: ${requiredRoles.join(' or ')}, but user has role: ${userRole}`,
      );
    }

    return true;
  }
}
