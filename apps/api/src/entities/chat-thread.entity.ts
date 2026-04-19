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
import { Document } from './document.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_threads')
export class ChatThread {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentId: string;

  @Column('uuid')
  workspaceId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null; // First question truncated; nullable until set

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;

  @OneToMany(() => ChatMessage, (message) => message.thread)
  messages: ChatMessage[];
}
