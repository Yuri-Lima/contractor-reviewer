import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';

export enum RedlinePlaybook {
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative',
  CLIENT_FRIENDLY = 'client-friendly',
}

@Entity('document_versions')
export class DocumentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentId: string;

  @Column('uuid')
  workspaceId: string;

  @Column('uuid')
  userId: string; // User who created this version

  @Column({ type: 'int' })
  versionNumber: number; // Sequential version number (1, 2, 3, ...)

  @Column({ type: 'enum', enum: RedlinePlaybook, nullable: true })
  playbook: RedlinePlaybook | null; // Playbook used for redline generation

  @Column({ type: 'text', nullable: true })
  instructions: string | null; // Custom instructions (if any)

  @Column({ type: 'jsonb', nullable: true })
  changes: Array<{
    section: string;
    originalText: string;
    suggestedText: string;
    diffBlocks: Array<{
      id: string;
      type: 'equal' | 'add' | 'remove';
      text: string;
    }>;
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
    citations: Array<{
      kind: 'contract';
      file?: string;
      page?: number;
      spanId?: string;
      quoteSnippet?: string;
    }>;
    legalCitations: Array<{
      kind: 'legal';
      source?: string;
      section?: string;
      url?: string;
    }>;
    notFound: boolean;
  }> | null; // Redline changes (may be null if no-logs enabled)

  @Column({ type: 'jsonb', nullable: true })
  decisions: Array<{
    blockId: string;
    decision: 'accept' | 'reject';
    userId: string;
    timestamp: Date;
  }> | null; // Decisions for accept/reject by block

  @Column({ type: 'uuid', nullable: true })
  parentVersionId: string | null; // Reference to parent version (for applied versions)

  @Column({ type: 'text', nullable: true })
  prompt: string | null; // Redline generation prompt (may be null if no-logs enabled)

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
