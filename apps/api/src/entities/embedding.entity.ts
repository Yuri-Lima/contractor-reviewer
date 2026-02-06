import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LegalSource } from './legal-source.entity';
import { vectorTransformer } from '../typeorm-vector.transformer';

// Embeddings for legal sources (separate from document chunks)
@Entity('embeddings')
export class Embedding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { nullable: true })
  legalSourceId: string; // Reference to legal source

  @Column({ type: 'text' })
  text: string;

  // Note: embedding is stored as 'vector' type in PostgreSQL (via migration)
  // Vector operations (similarity search) should use raw SQL queries
  @Column({ type: 'text', transformer: vectorTransformer })
  embedding: number[]; // pgvector column

  @Column({ nullable: true })
  section: string; // Article, section, etc.

  @Column({ nullable: true })
  metadata: string; // JSON string with additional metadata

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => LegalSource, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalSourceId' })
  legalSource: LegalSource;
}
