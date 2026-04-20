import type { LegalIssue } from '@contractai-review/shared';
import { MergeService } from './merge.service';

describe('MergeService', () => {
  let service: MergeService;

  beforeEach(() => {
    service = new MergeService();
  });

  const issue = (overrides: Partial<LegalIssue>): LegalIssue => ({
    severity: 'medium',
    category: 'other',
    message: 'msg',
    ...overrides,
  });

  it('passes through non-overlapping issues unchanged but sorted by severity', () => {
    const a = issue({ severity: 'low', category: 'ambiguous', message: 'A' });
    const b = issue({ severity: 'blocker', category: 'template-artefact', message: 'B' });
    const c = issue({ severity: 'high', category: 'missing-statute', message: 'C' });
    const merged = service.merge({ ruleIssues: [a], llmIssues: [b, c] });
    expect(merged.map((i) => i.message)).toEqual(['B', 'C', 'A']);
  });

  it('dedupes by (category, clauseRef) + message similarity and keeps the worst severity', () => {
    // Same bucket (missing-statute @ 9.1) AND messages are near-paraphrases
    // (Levenshtein similarity >= 0.85), so they collapse into one issue.
    const ruleHit = issue({
      severity: 'high',
      category: 'missing-statute',
      message: 'Pension clause does not reference governing statute.',
      clauseRef: '9.1',
      legislationRef: 'AE Act 2024',
    });
    const llmHit = issue({
      severity: 'medium',
      category: 'missing-statute',
      message: 'Pension clause does not reference governing statute',
      clauseRef: '9.1',
    });
    const merged = service.merge({ ruleIssues: [ruleHit], llmIssues: [llmHit] });
    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe('high');
    // Rule-sourced wording (the one with legislationRef) wins.
    expect(merged[0].legislationRef).toBe('AE Act 2024');
  });

  it('preserves distinct issues that share (category, clauseRef) but differ in message', () => {
    const llmA = issue({
      severity: 'medium',
      category: 'ambiguous',
      message: 'Term unclear: probation period length is undefined',
      clauseRef: '5',
    });
    const llmB = issue({
      severity: 'high',
      category: 'ambiguous',
      message: 'Notice period conflicts with statutory minimum',
      clauseRef: '5',
    });
    const merged = service.merge({ ruleIssues: [], llmIssues: [llmA, llmB] });
    expect(merged).toHaveLength(2);
  });

  it('treats two paraphrases of the same issue as one (similarity >= 0.85)', () => {
    const a = issue({
      severity: 'high',
      category: 'template-artefact',
      message: 'Unfilled placeholder token detected (e.g. [XX])',
      clauseRef: '2',
    });
    const b = issue({
      severity: 'medium',
      category: 'template-artefact',
      message: 'Unfilled placeholder token detected (e.g. [XX]).',
      clauseRef: '2',
    });
    const merged = service.merge({ ruleIssues: [a], llmIssues: [b] });
    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe('high');
  });

  it('keeps issues with no clauseRef but distinct messages in their own buckets per category', () => {
    const a = issue({ category: 'other', message: 'free-floating A' });
    const b = issue({
      category: 'other',
      message: 'wholly different floating note',
    });
    const merged = service.merge({ ruleIssues: [], llmIssues: [a, b] });
    expect(merged).toHaveLength(2);
  });

  it('carries over suggestion from whichever side has one', () => {
    const ruleHit = issue({
      category: 'deprecated-term',
      message: 'Deprecated term used',
      clauseRef: '11',
      suggestion: 'Use the AE Act 2024 wording',
    });
    const llmHit = issue({
      category: 'deprecated-term',
      message: 'Deprecated term used',
      clauseRef: '11',
    });
    const merged = service.merge({ ruleIssues: [ruleHit], llmIssues: [llmHit] });
    expect(merged).toHaveLength(1);
    expect(merged[0].suggestion).toBe('Use the AE Act 2024 wording');
  });
});
