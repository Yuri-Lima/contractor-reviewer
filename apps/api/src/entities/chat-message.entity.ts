import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { ChatThread } from './chat-thread.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  threadId: string; // Every message belongs to a thread

  @Column('uuid')
  documentId: string;

  @Column('uuid')
  workspaceId: string;

  @Column('uuid')
  userId: string; // User who asked the question

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant'; // For multi-turn clarity

  @Column({ type: 'text' })
  question: string; // User's question (role=user) or empty (role=assistant)

  @Column({ type: 'text', nullable: true })
  answerText: string | null; // AI answer (role=assistant; null for user or if no-logs)

  @Column({ type: 'varchar', nullable: true })
  confidence: string | null; // 'high' | 'medium' | 'low'

  @Column({ type: 'jsonb', nullable: true })
  citations: Array<{
    fileName?: string;
    pageNumber?: number;
    quoteSnippet?: string;
    sourceName?: string;
    section?: string;
    url?: string;
  }> | null;

  @Column({ default: false })
  notFound: boolean; // True if answer was "NOT FOUND"

  @Column({ type: 'varchar', nullable: true })
  jurisdiction: string | null; // Jurisdiction used for legal RAG

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.chatMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @ManyToOne(() => ChatThread, (thread) => thread.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'threadId' })
  thread: ChatThread;
}
