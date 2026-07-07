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

  /** Denormalized from legal_sources for vector-DB separation (no JOIN needed) */
  @Column({ nullable: true })
  sourceName: string;

  /** Denormalized from legal_sources */
  @Column({ nullable: true })
  country: string;

  /** Denormalized from legal_sources */
  @Column({ nullable: true })
  jurisdiction: string;

  /** Denormalized from legal_sources */
  @Column({ nullable: true })
  url: string;

  // Note: embedding is stored as 'vector' type in PostgreSQL (via migration)
  // Vector operations (similarity search) should use raw SQL queries
  @Column({ type: 'text', transformer: vectorTransformer })
  embedding: number[]; // pgvector column

  /**
   * OpenAI (or other) model that produced this vector, e.g.
   * `text-embedding-3-small` or `text-embedding-ada-002`.
   * Required to prevent silent RAG recall degradation when the default model
   * changes: mixed-model vectors are not comparable under cosine similarity.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  embeddingModel: string | null;

  @Column({ nullable: true })
  section: string; // Article, section, etc.

  /**
   * Canonical short name of the act (e.g. "Automatic Enrolment Retirement
   * Savings System Act"). Used for the legal-rerank similarity bonus —
   * document chunks that mention this string get +0.1 to their score so
   * the LLM sees the most-relevant statute first. Denormalized from the
   * authoring YAML (services/legal-corpus/<jurisdiction>/*.yaml).
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  actName: string | null;

  /** Year the act was enacted (used for "Pensions Act 1990" rendering). */
  @Column({ type: 'int', nullable: true })
  actYear: number | null;

  /**
   * Source verification stamp from the YAML's `lastVerified` field.
   * Used by the corpus-staleness lint script (warns when older than 6 months).
   */
  @Column({ type: 'date', nullable: true })
  lastVerified: Date | null;

  @Column({ nullable: true })
  metadata: string; // JSON string with additional metadata

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => LegalSource, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'legalSourceId' })
  legalSource: LegalSource;
}
