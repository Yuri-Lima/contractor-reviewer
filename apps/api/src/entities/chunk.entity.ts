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

  /**
   * Clause number extracted from the document's heading hierarchy
   * (e.g. "9.1.3"). Populated by the docling-side chunker when it
   * detects a numbered heading attached to the chunk's section. Null
   * for free-floating text or pre-Phase-2 chunks (until reindex).
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  clauseNumber: string | null;

  /**
   * Full breadcrumb path of headings that govern this chunk
   * (e.g. ["9. Pension", "9.1 Auto-enrolment", "9.1.3 Contributions"]).
   * Stored as jsonb so the array can be searched/displayed without
   * splitting a delimited string.
   */
  @Column({ type: 'jsonb', nullable: true })
  headingPath: string[] | null;

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
