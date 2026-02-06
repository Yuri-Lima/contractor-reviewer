import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { WorkspaceMember } from './workspace-member.entity';
import { Document } from './document.entity';
import { WorkspaceSettings } from './workspace-settings.entity';
import { AuditLog } from './audit-log.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => WorkspaceMember, (member) => member.workspace)
  members: WorkspaceMember[];

  @OneToMany(() => Document, (document) => document.workspace)
  documents: Document[];

  @OneToMany(() => WorkspaceSettings, (settings) => settings.workspace)
  settings: WorkspaceSettings[];

  @OneToMany(() => AuditLog, (log) => log.workspace)
  auditLogs: AuditLog[];
}
