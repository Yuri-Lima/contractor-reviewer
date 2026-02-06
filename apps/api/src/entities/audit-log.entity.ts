import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export enum AuditAction {
  OPEN_VIEW = 'open_view',
  DOWNLOAD = 'download',
  CHAT_QUERY = 'chat_query',
  REDLINE_GENERATE = 'redline_generate',
  DELETE = 'delete',
  EXPORT_PRIVACY = 'export_privacy',
  UPLOAD = 'upload',
  MEMBER_ADD = 'member_add',
  MEMBER_REMOVE = 'member_remove',
  SETTINGS_UPDATE = 'settings_update',
}

export enum TargetType {
  DOCUMENT = 'document',
  FILE = 'file',
  WORKSPACE = 'workspace',
  USER = 'user',
  CHAT = 'chat',
  VERSION = 'version',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  workspaceId: string;

  @Column('uuid')
  actorUserId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'enum', enum: TargetType })
  targetType: TargetType;

  @Column({ type: 'uuid', nullable: true })
  targetId: string | null;

  @Column({ type: 'varchar', nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null; // Safe metadata only (no contract content)

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Workspace, (workspace) => workspace.auditLogs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;
}
