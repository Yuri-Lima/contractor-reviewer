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
    original: string;
    suggested: string;
    reason: string;
  }> | null; // Redline changes (may be null if no-logs enabled)

  @Column({ type: 'text', nullable: true })
  prompt: string | null; // Redline generation prompt (may be null if no-logs enabled)

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
