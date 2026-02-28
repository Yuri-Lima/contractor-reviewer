import { Injectable, UnauthorizedException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import {
  isTranscriptionProviderId,
  type TranscriptionProviderId,
  type User as ApiUser,
} from '@contractai-review/shared';
import { User } from '../entities/user.entity';
import { LoginDto, RegisterDto } from './dto';
import { WorkspaceMember, WorkspaceRole } from '../entities/workspace-member.entity';
import { AssetManagerService } from '../asset-manager/asset-manager.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    private jwtService: JwtService,
    private assetManagerService: AssetManagerService,
  ) {}

  private static getGravatarUrl(email: string): string {
    const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=200&d=identicon`;
  }

  async serializeUserWithAvatar(user: Omit<User, 'passwordHash'>): Promise<ApiUser> {
    const asset = await this.assetManagerService.getAsset('avatar', user.id);
    const avatarUrl = asset
      ? 'account/avatar'
      : AuthService.getGravatarUrl(user.email);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async register(registerDto: RegisterDto): Promise<{ user: ApiUser; accessToken: string }> {
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const userEntity = this.userRepository.create({
      email: registerDto.email,
      passwordHash,
      name: registerDto.name,
    });

    const savedUser = await this.userRepository.save(userEntity);

    const payload = { sub: savedUser.id, email: savedUser.email };
    const accessToken = this.jwtService.sign(payload);

    const { passwordHash: _, ...userWithoutPassword } = savedUser;
    const user = await this.serializeUserWithAvatar(userWithoutPassword);

    return {
      user,
      accessToken,
    };
  }

  async validateUser(email: string, password: string): Promise<Omit<User, 'passwordHash'> | null> {
    const normalizedEmail = email?.trim().toLowerCase();
    if (!normalizedEmail) return null;

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async login(loginDto: LoginDto): Promise<{ user: ApiUser; accessToken: string }> {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    const serializedUser = await this.serializeUserWithAvatar(user);
    return {
      user: serializedUser,
      accessToken,
    };
  }

  /**
   * Reserved for future "personal default override". Transcription currently uses workspace settings.
   */
  async getPreferredTranscriptionProvider(userId: string): Promise<TranscriptionProviderId | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['preferredTranscriptionProvider'],
    });
    const raw = user?.preferredTranscriptionProvider ?? null;
    return raw && isTranscriptionProviderId(raw) ? raw : null;
  }

  /**
   * Reserved for future "personal default override". Transcription currently uses workspace settings.
   */
  async updatePreferredTranscriptionProvider(
    userId: string,
    provider: TranscriptionProviderId,
  ): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { preferredTranscriptionProvider: provider },
    );
  }

  async getAccount(userId: string): Promise<ApiUser | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user || !user.isActive) return null;
    const { passwordHash: _, ...userWithoutPassword } = user;
    return this.serializeUserWithAvatar(userWithoutPassword);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<Omit<User, 'passwordHash'> | null> {
    // Normalizar email: trim + lowercase
    const normalizedEmail = email?.trim().toLowerCase();
    
    if (!normalizedEmail) {
      this.logger.warn('findByEmail called with empty email');
      return null;
    }
    
    this.logger.debug(`Searching for user with email: ${normalizedEmail}`);
    
    // Buscar usuário com email normalizado (case-insensitive)
    // Usando QueryBuilder com LOWER para garantir busca case-insensitive
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email: normalizedEmail })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .getOne();
    
    if (!user) {
      this.logger.debug(`User not found with email: ${normalizedEmail}`);
      return null;
    }
    
    this.logger.debug(`User found: ${user.id} - ${user.email}`);
    
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Hard delete user account and associated data (idempotent)
   * Returns true if account was deleted, false if it didn't exist
   * 
   * Restrictions:
   * - Cannot delete if user is the only OWNER of any workspace
   * - Removes user from workspace memberships (non-OWNER roles)
   * - Marks user as inactive (soft delete) if they own workspaces
   */
  async deleteAccount(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['workspaceMemberships'],
    });

    // Idempotent: if user doesn't exist, return false (already deleted)
    if (!user) {
      return false;
    }

    // Check if user is OWNER of any workspaces
    const ownedWorkspaces = await this.workspaceMemberRepository.find({
      where: {
        userId,
        role: WorkspaceRole.OWNER,
      },
    });

    if (ownedWorkspaces.length > 0) {
      // Check if user is the only OWNER of any workspace
      for (const membership of ownedWorkspaces) {
        const ownersCount = await this.workspaceMemberRepository.count({
          where: {
            workspaceId: membership.workspaceId,
            role: WorkspaceRole.OWNER,
          },
        });

        if (ownersCount === 1) {
          // User is the only owner - cannot delete, mark as inactive instead
          user.isActive = false;
          await this.userRepository.save(user);
          throw new BadRequestException(
            'Cannot delete account: user is the only owner of one or more workspaces. Account has been deactivated instead.',
          );
        }
      }
    }

    // Remove user from all workspace memberships (CASCADE will handle cleanup)
    if (user.workspaceMemberships && user.workspaceMemberships.length > 0) {
      await this.workspaceMemberRepository.remove(user.workspaceMemberships);
    }

    // Hard delete user (CASCADE will handle related data)
    await this.userRepository.remove(user);
    return true;
  }
}
