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
  noLogsEnabled: boolean; // When true, don't persist contract content or chat

  @Column({ type: 'jsonb', nullable: true })
  noLogsConfig: {
    skipDocumentContent?: boolean; // Don't persist document text/chunks after processing
    skipChatMessages?: boolean; // Don't persist chat questions/answers
    acceleratedPurgeDays?: number; // Purge data after N days (default: 1 day)
  } | null; // Granular no-logs configuration

  @Column({ type: 'jsonb', nullable: true })
  retentionOverrides: Record<string, number>; // Overrides per document type or other criteria

  @Column({ type: 'int', default: 70 })
  fuzzyMatchThreshold: number; // Minimum match percentage for fuzzy matching (0-100)

  @Column({ type: 'varchar', default: 'paragraph' })
  chunkingStrategy: string; // paragraph | sentence | fixed_size | semantic | agentic

  @Column({ type: 'varchar', default: 'docling' })
  defaultDocumentParser: string;

  /** Default LLM provider for chat (openai | anthropic) */
  @Column({ type: 'varchar', nullable: true })
  defaultLlmProvider: string | null;

  @Column({ type: 'jsonb', nullable: true })
  parserApiKeys: Record<string, string> | null;

  /** Encrypted API keys for transcription providers (huggingface, openai) */
  @Column({ type: 'jsonb', nullable: true })
  transcriptionProviderApiKeys: Record<string, string> | null;

  /** Preferred transcription provider for this workspace (huggingface | openai) */
  @Column({ type: 'varchar', nullable: true })
  preferredTranscriptionProvider: string | null;

  /** Encrypted API keys for TTS providers (replicate_xtts, huggingface, openai) */
  @Column({ type: 'jsonb', nullable: true })
  ttsProviderApiKeys: Record<string, string> | null;

  /** Preferred TTS provider for this workspace */
  @Column({ type: 'varchar', nullable: true })
  preferredTtsProvider: string | null;

  /** Per-provider config (plan, output format, etc.). Keys are TtsProviderId. */
  @Column({ type: 'jsonb', nullable: true })
  ttsProviderConfig: Record<string, { plan?: string; outputFormat?: string }> | null;

  /** Chat response mode: text_only | audio_only | audio_and_text */
  @Column({ type: 'varchar', nullable: true, default: 'text_only' })
  chatResponseMode: string | null;

  /** Auto-send message after voice recording completes */
  @Column({ type: 'boolean', default: false })
  voiceAutoSend: boolean;

  /** Include global prompts when building combined prompt (additive model) */
  @Column({ type: 'boolean', default: true })
  promptScopeIncludeGlobal: boolean;

  /** Include workspace prompts when building combined prompt (additive model) */
  @Column({ type: 'boolean', default: true })
  promptScopeIncludeWorkspace: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Workspace, (workspace) => workspace.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;
}
