import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '../entities/workspace-member.entity';
import { Workspace } from '../entities/workspace.entity';

@Injectable()
export class SuperadminService implements OnModuleInit {
  private readonly logger = new Logger(SuperadminService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(Workspace)
    private workspaceRepository: Repository<Workspace>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get<string>('SUPERADMIN_ENABLED', 'true') === 'true';
    
    if (!enabled) {
      this.logger.log('Superadmin creation is disabled');
      return;
    }

    const email = this.configService.get<string>('SUPERADMIN_EMAIL');
    const password = this.configService.get<string>('SUPERADMIN_PASSWORD');
    const name = this.configService.get<string>('SUPERADMIN_NAME', 'Super Admin');

    if (!email || !password) {
      this.logger.warn('SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set, skipping superadmin creation');
      return;
    }

    await this.ensureSuperadmin(email, password, name);
  }

  private async ensureSuperadmin(email: string, password: string, name: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if superadmin already exists
    let superadmin = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (superadmin) {
      this.logger.log(`Superadmin already exists: ${superadmin.email}`);

      // Update name if provided
      if (name && superadmin.name !== name) {
        superadmin.name = name;
      }

      // Sync password from env so SUPERADMIN_PASSWORD changes take effect on restart
      superadmin.passwordHash = await bcrypt.hash(password, 10);
      await this.userRepository.save(superadmin);
    } else {
      // Create superadmin
      const passwordHash = await bcrypt.hash(password, 10);
      
      superadmin = this.userRepository.create({
        email: normalizedEmail,
        passwordHash,
        name,
        isActive: true,
      });

      superadmin = await this.userRepository.save(superadmin);
      this.logger.log(`Superadmin created: ${superadmin.email} - ${superadmin.name}`);
    }

    // Ensure superadmin is Owner of all workspaces
    await this.ensureSuperadminOwnership(superadmin.id);
  }

  private async ensureSuperadminOwnership(superadminId: string): Promise<void> {
    // Get all workspaces
    const workspaces = await this.workspaceRepository.find();

    for (const workspace of workspaces) {
      // Check if superadmin is already a member
      const membership = await this.workspaceMemberRepository.findOne({
        where: {
          workspaceId: workspace.id,
          userId: superadminId,
        },
      });

      if (!membership) {
        // Add superadmin as Owner
        const newMembership = this.workspaceMemberRepository.create({
          workspaceId: workspace.id,
          userId: superadminId,
          role: WorkspaceRole.OWNER,
        });
        await this.workspaceMemberRepository.save(newMembership);
        this.logger.log(`Added superadmin as Owner to workspace: ${workspace.name} (${workspace.id})`);
      } else if (membership.role !== WorkspaceRole.OWNER) {
        // Update role to Owner if not already
        membership.role = WorkspaceRole.OWNER;
        await this.workspaceMemberRepository.save(membership);
        this.logger.log(`Updated superadmin role to Owner in workspace: ${workspace.name} (${workspace.id})`);
      }
    }
  }
}
