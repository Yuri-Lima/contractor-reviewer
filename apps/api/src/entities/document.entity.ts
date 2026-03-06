import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { DocumentStatus, JurisdictionStatus } from '@contractai-review/shared';
import { Workspace } from './workspace.entity';
import { DocumentFile } from './document-file.entity';
import { Chunk } from './chunk.entity';
import { DocumentJob } from './document-job.entity';
import { ChatMessage } from './chat-message.entity';
import { DocumentVersion } from './document-version.entity';

// Re-export for backward compatibility
export { DocumentStatus, JurisdictionStatus };

/** Stored in jurisdictionCandidates JSONB - candidate jurisdiction with evidence */
export interface JurisdictionCandidateEntity {
  jurisdiction: string;
  status: 'explicit' | 'inferred';
  confidence: number;
  evidenceCount: number;
  fileNames: string[];
  snippets: string[];
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  workspaceId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.PROCESSING })
  status: DocumentStatus;

  @Column({ type: 'varchar', nullable: true })
  resolvedJurisdiction: string | null; // e.g., "US-CA", "BR-SP"; null to clear

  @Column({ type: 'enum', enum: JurisdictionStatus, nullable: true })
  jurisdictionStatus: JurisdictionStatus;

  @Column({ nullable: true })
  detectedLanguage: string; // ISO 639-1 code (en, es, pt)

  /** Include document prompts when building combined prompt (additive model) */
  @Column({ type: 'boolean', default: true })
  promptScopeIncludeDocument: boolean;

  /** Prompt category (e.g. legal-law). When LEGAL_RAG_CATEGORY_ID + resolvedJurisdiction, enables Legal RAG. */
  @Column({ type: 'varchar', nullable: true })
  promptCategoryId: string | null;

  /** List of jurisdiction candidates with evidence for user override */
  @Column({ type: 'jsonb', nullable: true })
  jurisdictionCandidates: JurisdictionCandidateEntity[] | null;

  /** AI reasoning for chosen jurisdiction */
  @Column({ type: 'text', nullable: true })
  jurisdictionReasoning: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Workspace, (workspace) => workspace.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspaceId' })
  workspace: Workspace;

  @OneToMany(() => DocumentFile, (file) => file.document)
  files: DocumentFile[];

  @OneToMany(() => Chunk, (chunk) => chunk.document)
  chunks: Chunk[];

  @OneToMany(() => DocumentJob, (job) => job.document)
  jobs: DocumentJob[];

  @OneToMany(() => ChatMessage, (message) => message.document)
  chatMessages: ChatMessage[];

  @OneToMany(() => DocumentVersion, (version) => version.document)
  versions: DocumentVersion[];
}
