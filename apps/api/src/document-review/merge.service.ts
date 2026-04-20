import { Injectable } from '@nestjs/common';
import type { LegalIssue, IssueSeverity } from '@contractai-review/shared';
import { ISSUE_SEVERITY_RANK } from '@contractai-review/shared';

interface MergeInputs {
  ruleIssues: LegalIssue[];
  llmIssues: LegalIssue[];
}

const SIMILARITY_TIE_BREAKER = 0.85;

/**
 * Deduplicates rule + LLM issues into a single set.
 *
 * Primary key: `(category, clauseRef ?? '__none__')`. Two issues that share
 * this key collapse into one.
 *
 * Secondary key (tie-breaker): when the primary key collides for two LLM
 * issues from different windows, also require message similarity ≥ 0.85
 * (Levenshtein-based) before deduping. Avoids losing distinct issues that
 * happen to fall in the same clause.
 *
 * Severity merge: keep the WORST (highest rank) severity. A "high" + "low"
 * dedup yields "high".
 *
 * Source preference for the merged issue's `message`: rule wins (curated
 * wording is more consistent for the UI than free-form LLM text).
 */
@Injectable()
export class MergeService {
  merge(inputs: MergeInputs): LegalIssue[] {
    const buckets = new Map<string, LegalIssue[]>();
    for (const issue of [...inputs.ruleIssues, ...inputs.llmIssues]) {
      const key = `${issue.category}::${issue.clauseRef ?? '__none__'}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.push(issue);
      } else {
        buckets.set(key, [issue]);
      }
    }

    const merged: LegalIssue[] = [];
    for (const [, group] of buckets) {
      if (group.length === 1) {
        merged.push(group[0]);
        continue;
      }
      // Cluster by message similarity within the bucket so distinct items
      // sharing (category, clauseRef) survive.
      const clusters = this.clusterBySimilarity(group);
      for (const cluster of clusters) {
        merged.push(this.collapseCluster(cluster));
      }
    }

    return merged.sort(
      (a, b) => ISSUE_SEVERITY_RANK[b.severity] - ISSUE_SEVERITY_RANK[a.severity],
    );
  }

  private clusterBySimilarity(issues: LegalIssue[]): LegalIssue[][] {
    const clusters: LegalIssue[][] = [];
    for (const issue of issues) {
      const target = clusters.find(
        (c) => similarity(c[0].message, issue.message) >= SIMILARITY_TIE_BREAKER,
      );
      if (target) target.push(issue);
      else clusters.push([issue]);
    }
    return clusters;
  }

  private collapseCluster(cluster: LegalIssue[]): LegalIssue {
    // Pick the one with the worst severity (highest rank).
    const sorted = [...cluster].sort(
      (a, b) => ISSUE_SEVERITY_RANK[b.severity] - ISSUE_SEVERITY_RANK[a.severity],
    );
    const worst = sorted[0];
    const severity: IssueSeverity = worst.severity;
    // Prefer a message that came with `legislationRef` (rule-sourced),
    // otherwise the worst issue's message.
    const withLeg = cluster.find((i) => !!i.legislationRef);
    const message = withLeg?.message ?? worst.message;
    const suggestion = cluster.find((i) => i.suggestion)?.suggestion;
    const legislationRef = withLeg?.legislationRef;
    return {
      severity,
      category: worst.category,
      message,
      ...(worst.clauseRef ? { clauseRef: worst.clauseRef } : {}),
      ...(suggestion ? { suggestion } : {}),
      ...(legislationRef ? { legislationRef } : {}),
    };
  }
}

/** Levenshtein-distance-based normalised similarity, range [0, 1]. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const dist = levenshtein(a.toLowerCase(), b.toLowerCase());
  return 1 - dist / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}
