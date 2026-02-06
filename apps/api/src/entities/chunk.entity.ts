import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { vectorTransformer } from '../typeorm-vector.transformer';

@Entity('chunks')
export class Chunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentId: string;

  @Column({ type: 'int', nullable: true })
  pageNumber: number;

  @Column({ nullable: true })
  paragraphId: string; // Identifier for paragraph/span

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'int', default: 0 })
  startIndex: number; // Character offset in original text

  @Column({ type: 'int', default: 0 })
  endIndex: number;

  // Note: embedding is stored as 'vector' type in PostgreSQL (via migration)
  // Vector operations (similarity search) should use raw SQL queries
  @Column({ type: 'text', nullable: true, transformer: vectorTransformer })
  embedding: number[] | null; // pgvector column

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Document, (document) => document.chunks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
