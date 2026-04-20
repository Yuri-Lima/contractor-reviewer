import type { LegalIssue, IssueSeverity, IssueCategory } from '@contractai-review/shared';

/**
 * One rule loaded from a YAML file under `services/red-flag-rules/<version>/`.
 * Two flavours exist:
 *  - `pattern` rules fire when the regex matches the document text;
 *  - `topicPattern` + `requiredAnyPattern` rules fire when the topic regex
 *    matches AND none of the required-any regexes match (i.e. the contract
 *    discusses the topic but never names the governing statute).
 */
export interface RawRuleFile {
  rulesVersion: string;
  category: IssueCategory;
  appliesTo: string; // 'any' or 'jurisdiction:<code>'
  rules: Array<RawRule>;
}

export interface RawRule {
  id: string;
  pattern?: string;
  flags?: string;
  topicPattern?: string;
  requiredAnyPattern?: string[];
  severity: IssueSeverity;
  message: string;
  remediation?: string;
  legislationReferenced?: Array<{
    actName: string;
    actYear?: number;
    section?: string;
    url?: string;
  }>;
}

export interface DetectorContext {
  jurisdiction?: string | null;
  /** Concatenated document text (markdown form). */
  text: string;
  /** Per-chunk text with optional clauseNumber for clauseRef enrichment. */
  chunks: Array<{ text: string; clauseNumber?: string | null }>;
}

export interface DetectorRuleHit {
  ruleId: string;
  rulesVersion: string;
  issue: LegalIssue;
}
