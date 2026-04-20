/**
 * Legal-grade RAG Answer Quality types.
 *
 * Shared between API and UI. The `LegalAnswer` shape is the structured-output
 * contract that the LLM is required to produce when `LEGAL_REVIEW_MODE=on`,
 * and that the persistent drafting reviewer (Phase 4) uses for its red flags.
 *
 * Keep this file dependency-free (no imports) so the JSON schema can be
 * generated from a parallel Zod schema in the API without circular imports.
 */

/** Severity ladder (descending). UI sorts issues by this order. */
export const ISSUE_SEVERITIES = ['blocker', 'high', 'medium', 'low', 'info'] as const;
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];

/** Numeric weight for severity comparison (higher = more severe). */
export const ISSUE_SEVERITY_RANK: Record<IssueSeverity, number> = {
  blocker: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

/**
 * Categorisation of issues. Used as part of the dedupe primary key.
 * Keep the strings stable — they are used as i18n keys
 * (`legalAnswer.category.<value>`), persisted in `document_reviews.issues`,
 * and emitted by both rule-based and LLM detectors.
 */
export const ISSUE_CATEGORIES = [
  'compliance',
  'drafting',
  'terminology',
  'missing-statute',
  'deprecated-term',
  'template-artefact',
  'ambiguous',
  'other',
] as const;
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];

/**
 * A single drafting / compliance issue surfaced by the LLM (chat) or the
 * persistent reviewer pass.
 */
export interface LegalIssue {
  severity: IssueSeverity;
  category: IssueCategory;
  /** Clause label, e.g. "9.1.3" or "Section 9 — Pension". Optional for document-wide issues. */
  clauseRef?: string;
  /** Human-readable explanation of what is wrong. */
  message: string;
  /** Optional named-statute reference, e.g. "Automatic Enrolment Retirement Savings System Act 2024, s.5". */
  legislationRef?: string;
  /** Optional concrete suggestion for the change. */
  suggestion?: string;
}

/**
 * Reference to a piece of legislation surfaced in the answer.
 * The model is instructed to copy `name + year + section` verbatim from the
 * provided "Legal sources" block — no invention.
 */
export interface LegislationReference {
  name: string;
  year?: number;
  section?: string;
}

/**
 * Item in the "Compliant elements" section — what the contract gets right.
 */
export interface CompliantElement {
  clauseRef?: string;
  rationale: string;
}

/**
 * Confidence ladder for legal answers. Calibration rules live in the system
 * prompt:
 *   high   = >=1 named statute matched + >=1 clause cited + no contradictions
 *   medium = clause cited but no statute matched
 *   low    = neither (or graceful-degradation path)
 */
export type LegalAnswerConfidence = 'high' | 'medium' | 'low';

/**
 * Strict structured response shape for legal-grade RAG answers.
 *
 * The Zod validator + JSON schema for this type live in
 * `apps/api/src/rag/legal-answer.schema.ts`. They MUST stay in sync with
 * this interface — the API generates the JSON schema from the Zod schema
 * via `zod-to-json-schema` at module init.
 */
export interface LegalAnswer {
  compliantElements: CompliantElement[];
  issues: LegalIssue[];
  recommendations: string[];
  legislationReferenced: LegislationReference[];
  confidence: LegalAnswerConfidence;
  /** Optional human prose summary, ≤500 chars. Used as fallback for legacy renderers. */
  freeText?: string;
}

/**
 * Sort issues by severity (descending), then by clauseRef (ascending) for
 * stable display ordering.
 */
export function sortIssuesBySeverity(issues: LegalIssue[]): LegalIssue[] {
  return [...issues].sort((a, b) => {
    const sevDiff = ISSUE_SEVERITY_RANK[b.severity] - ISSUE_SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    const aRef = a.clauseRef ?? '';
    const bRef = b.clauseRef ?? '';
    return aRef.localeCompare(bRef, undefined, { numeric: true });
  });
}

/** Aggregated counts emitted alongside a `DocumentReview`. */
export interface DocumentReviewIssueCounts {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/** Run status of a persistent review. */
export type DocumentReviewStatus = 'succeeded' | 'degraded' | 'failed';

/**
 * Result of a persistent drafting-review pass for a single document.
 * Persisted in the `document_reviews` table; served by
 * `GET /workspaces/:wsId/documents/:docId/review`.
 */
export interface DocumentReview {
  id: string;
  documentId: string;
  /** Version of the rule set that produced this review. */
  rulesVersion: string;
  /** Provider+model used for the LLM detector layer (null if rules-only). */
  llmModel: string | null;
  issues: LegalIssue[];
  compliantElements: CompliantElement[];
  recommendations: string[];
  legislationReferenced: LegislationReference[];
  issueCounts: DocumentReviewIssueCounts;
  durationMs: number;
  status: DocumentReviewStatus;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}
