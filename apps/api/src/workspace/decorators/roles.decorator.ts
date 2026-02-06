import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '../../entities/workspace-member.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required workspace roles for an endpoint
 * Usage: @Roles(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)
 */
export const Roles = (...roles: WorkspaceRole[]) => SetMetadata(ROLES_KEY, roles);
