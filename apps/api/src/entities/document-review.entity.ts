import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import type {
  CompliantElement,
  LegalIssue,
  LegislationReference,
} from '@contractai-review/shared';
import { Document } from './document.entity';

/**
 * Persistent drafting review for a single document. Phase 4 of the
 * legal-grade RAG pipeline.
 *
 * One row per (documentId, rulesVersion, llmModel) — see the unique index
 * below; running the review again with the same rules/model is a no-op
 * idempotency win, while bumping either dimension produces a fresh row so
 * historical reviews remain attributable.
 *
 * `issues`, `compliantElements`, `recommendations`, and `legislationReferenced`
 * are stored as jsonb so the UI can render the full structured shape without
 * an extra join, and so a future migration can index into them via gin.
 */
@Entity('document_reviews')
@Unique('uq_document_review_doc_rules_model', [
  'documentId',
  'rulesVersion',
  'llmModel',
])
@Index('idx_document_review_doc', ['documentId'])
export class DocumentReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  documentId: string;

  /**
   * Version of the red-flag rules YAML used to produce this review. Bumped
   * whenever rules change so we never silently overwrite a review with one
   * computed under different rules.
   */
  @Column({ type: 'varchar', length: 32 })
  rulesVersion: string;

  /**
   * Model id used by the LLM detector (e.g. "gpt-4o", "claude-opus-4-7").
   * Null if the run was rules-only.
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  llmModel: string | null;

  /** Severity-tagged issues, sorted by severity. */
  @Column({ type: 'jsonb' })
  issues: LegalIssue[];

  @Column({ type: 'jsonb' })
  compliantElements: CompliantElement[];

  @Column({ type: 'jsonb' })
  recommendations: string[];

  @Column({ type: 'jsonb' })
  legislationReferenced: LegislationReference[];

  /**
   * Counts cached on the row for quick rendering / audit-log payloads
   * without re-walking the issues jsonb.
   */
  @Column({ type: 'jsonb' })
  issueCounts: {
    blocker: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  /** Wall-clock duration of the review run, in ms. Used for cost dashboards. */
  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  /**
   * Status of the run. `succeeded` is the happy path; `degraded` means the
   * LLM detector failed and only rules-based issues are present.
   */
  @Column({ type: 'varchar', length: 16, default: 'succeeded' })
  status: 'succeeded' | 'degraded' | 'failed';

  /** Error message if `status === 'failed'`. */
  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: Document;
}
