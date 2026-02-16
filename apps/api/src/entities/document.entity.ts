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

  @Column({ nullable: true })
  resolvedJurisdiction: string; // e.g., "US-CA", "BR-SP"

  @Column({ type: 'enum', enum: JurisdictionStatus, nullable: true })
  jurisdictionStatus: JurisdictionStatus;

  @Column({ nullable: true })
  detectedLanguage: string; // ISO 639-1 code (en, es, pt)

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
