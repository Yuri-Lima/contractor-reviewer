import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('workspace_settings')
export class WorkspaceSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  workspaceId: string;

  @Column({ type: 'int', default: 30 })
  defaultFileRetentionDays: number;

  @Column({ type: 'int', default: 90 })
  defaultTextEmbeddingsRetentionDays: number;

  @Column({ default: false })
  noLogsEnabled: boolean; // When true, don't persist contract content or chat/versions

  @Column({ type: 'jsonb', nullable: true })
  noLogsConfig: {
    skipDocumentContent?: boolean; // Don't persist document text/chunks after processing
    skipChatMessages?: boolean; // Don't persist chat questions/answers
    skipVersions?: boolean; // Don't persist version changes/prompts
    acceleratedPurgeDays?: number; // Purge data after N days (default: 1 day)
  } | null; // Granular no-logs configuration

  @Column({ type: 'jsonb', nullable: true })
  retentionOverrides: Record<string, number>; // Overrides per document type or other criteria

  @Column({ type: 'int', default: 70 })
  fuzzyMatchThreshold: number; // Minimum match percentage for fuzzy matching (0-100)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Workspace, (workspace) => workspace.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;
}
