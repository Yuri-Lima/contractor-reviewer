import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceMember, WorkspaceRole } from '../entities/workspace-member.entity';
import { Workspace } from '../entities/workspace.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';

@Injectable()
export class WorkspaceService {
  constructor(
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(WorkspaceSettings)
    private workspaceSettingsRepository: Repository<WorkspaceSettings>,
  ) {}

  /**
   * Create a new workspace and add creator as OWNER
   */
  async create(name: string, creatorUserId: string): Promise<Workspace> {
    const workspace = this.workspaceRepository.create({ name });
    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Add creator as OWNER
    const membership = this.workspaceMemberRepository.create({
      workspaceId: savedWorkspace.id,
      userId: creatorUserId,
      role: WorkspaceRole.OWNER,
    });
    await this.workspaceMemberRepository.save(membership);

    // Create default settings
    const settings = this.workspaceSettingsRepository.create({
      workspaceId: savedWorkspace.id,
    });
    await this.workspaceSettingsRepository.save(settings);

    // Reload workspace to ensure all fields are populated
    const reloadedWorkspace = await this.workspaceRepository.findOne({
      where: { id: savedWorkspace.id },
    });

    // Ensure we return a workspace with all required fields
    const workspaceToReturn = reloadedWorkspace || savedWorkspace;
    return {
      id: workspaceToReturn.id,
      name: workspaceToReturn.name || '',
      createdAt: workspaceToReturn.createdAt,
      updatedAt: workspaceToReturn.updatedAt,
    } as Workspace;
  }

  /**
   * Get all workspaces for a user
   */
  async findByUserId(userId: string): Promise<Workspace[]> {
    const memberships = await this.workspaceMemberRepository.find({
      where: { userId },
      relations: ['workspace'],
    });

    // Map to workspaces and ensure all fields are included
    const workspaces = memberships.map((membership) => membership.workspace).filter(Boolean);
    
    // Reload workspaces individually to ensure all fields are populated
    const workspaceIds = workspaces.map((ws) => ws.id);
    const reloadedWorkspaces = await this.workspaceRepository.find({
      where: workspaceIds.map((id) => ({ id })),
    });

    // Create a map for quick lookup
    const workspaceMap = new Map(reloadedWorkspaces.map((ws) => [ws.id, ws]));

    // Return workspaces with all fields, preserving order
    return workspaces
      .map((ws) => {
        const reloaded = workspaceMap.get(ws.id);
        return reloaded || ws;
      })
      .map((workspace) => ({
        id: workspace.id,
        name: workspace.name || '',
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      })) as Workspace[];
  }

  /**
   * Get workspace by ID, ensuring it exists
   */
  async findById(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace ${workspaceId} not found`);
    }

    return workspace;
  }

  /**
   * Get user's membership in a workspace
   */
  async getMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    return this.workspaceMemberRepository.findOne({
      where: {
        workspaceId,
        userId,
      },
      relations: ['workspace', 'user'],
    });
  }

  /**
   * Check if user is a member of the workspace
   */
  async isMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(workspaceId, userId);
    return membership !== null;
  }

  /**
   * Get user's role in a workspace
   */
  async getUserRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const membership = await this.getMembership(workspaceId, userId);
    return membership?.role || null;
  }

  /**
   * Verify user has required role (or higher) in workspace
   * Role hierarchy: OWNER > ADMIN > MEMBER > VIEWER
   */
  async hasRequiredRole(
    workspaceId: string,
    userId: string,
    requiredRole: WorkspaceRole,
  ): Promise<boolean> {
    const userRole = await this.getUserRole(workspaceId, userId);

    if (!userRole) {
      return false;
    }

    const roleHierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.MEMBER]: 2,
      [WorkspaceRole.VIEWER]: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  }

  /**
   * Verify user has any of the required roles
   */
  async hasAnyRole(
    workspaceId: string,
    userId: string,
    requiredRoles: WorkspaceRole[],
  ): Promise<boolean> {
    const userRole = await this.getUserRole(workspaceId, userId);
    if (!userRole) {
      return false;
    }

    const roleHierarchy: Record<WorkspaceRole, number> = {
      [WorkspaceRole.OWNER]: 4,
      [WorkspaceRole.ADMIN]: 3,
      [WorkspaceRole.MEMBER]: 2,
      [WorkspaceRole.VIEWER]: 1,
    };

    const userRoleLevel = roleHierarchy[userRole];
    return requiredRoles.some(
      (requiredRole) => userRoleLevel >= roleHierarchy[requiredRole],
    );
  }

  /**
   * Verify membership and throw if not a member
   */
  async verifyMembership(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    const membership = await this.getMembership(workspaceId, userId);

    if (!membership) {
      throw new ForbiddenException(
        `User ${userId} is not a member of workspace ${workspaceId}`,
      );
    }

    return membership;
  }

  /**
   * Verify user has required role and throw if not
   */
  async verifyRole(
    workspaceId: string,
    userId: string,
    requiredRole: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const membership = await this.verifyMembership(workspaceId, userId);

    if (!(await this.hasRequiredRole(workspaceId, userId, requiredRole))) {
      throw new ForbiddenException(
        `User ${userId} does not have required role ${requiredRole} in workspace ${workspaceId}`,
      );
    }

    return membership;
  }

  /**
   * Get all members of a workspace
   */
  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    // Verify workspace exists
    await this.findById(workspaceId);

    return this.workspaceMemberRepository.find({
      where: { workspaceId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });
  }

  /**
   * Add a member to a workspace
   */
  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    // Verify workspace exists
    await this.findById(workspaceId);

    // Check if already a member
    const existing = await this.getMembership(workspaceId, userId);
    if (existing) {
      throw new ForbiddenException('User is already a member of this workspace');
    }

    const membership = this.workspaceMemberRepository.create({
      workspaceId,
      userId,
      role,
    });

    return this.workspaceMemberRepository.save(membership);
  }

  /**
   * Update a member's role in a workspace
   * Only OWNER can update roles
   * OWNER cannot change their own role
   */
  async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole,
    currentUserId: string,
  ): Promise<WorkspaceMember> {
    const membership = await this.getMembership(workspaceId, userId);
    if (!membership) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    // Only OWNER can update roles
    const currentUserRole = await this.getUserRole(workspaceId, currentUserId);
    if (currentUserRole !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only OWNER can update member roles');
    }

    // OWNER cannot change their own role
    if (userId === currentUserId) {
      throw new ForbiddenException('OWNER cannot change their own role');
    }

    membership.role = newRole;
    return this.workspaceMemberRepository.save(membership);
  }

  /**
   * Remove a member from a workspace
   * OWNER cannot remove themselves
   * ADMIN cannot remove OWNER
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    currentUserId: string,
  ): Promise<void> {
    const membership = await this.getMembership(workspaceId, userId);
    if (!membership) {
      throw new NotFoundException('User is not a member of this workspace');
    }

    // OWNER cannot remove themselves
    if (userId === currentUserId && membership.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException('OWNER cannot remove themselves from the workspace');
    }

    // ADMIN cannot remove OWNER
    const currentUserRole = await this.getUserRole(workspaceId, currentUserId);
    if (
      membership.role === WorkspaceRole.OWNER &&
      currentUserRole !== WorkspaceRole.OWNER
    ) {
      throw new ForbiddenException('Only OWNER can remove another OWNER');
    }

    await this.workspaceMemberRepository.remove(membership);
  }

  /**
   * Delete a workspace (hard delete - idempotent)
   * Only OWNER can delete workspace
   * Returns true if workspace was deleted, false if it didn't exist
   */
  async delete(workspaceId: string, userId: string): Promise<boolean> {
    // Verify user is OWNER
    const userRole = await this.getUserRole(workspaceId, userId);
    if (userRole !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only workspace OWNER can delete the workspace');
    }

    // Verify workspace exists
    const workspace = await this.workspaceRepository.findOne({
      where: { id: workspaceId },
    });

    // Idempotent: if workspace doesn't exist, return false (already deleted)
    if (!workspace) {
      return false;
    }

    // Delete workspace (CASCADE will handle members, settings, documents, etc.)
    await this.workspaceRepository.remove(workspace);
    return true;
  }
}
