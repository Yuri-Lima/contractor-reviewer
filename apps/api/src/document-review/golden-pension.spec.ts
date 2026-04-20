import type { ConfigService } from '@nestjs/config';
import { RuleDetectorService } from './rules/rule-detector.service';
import { RuleLoaderService } from './rules/rule-loader.service';
import { MergeService } from './merge.service';

/**
 * Golden-answer pipeline test for a synthetic Irish pension clause.
 *
 * The excerpt below is invented for this test. It is built to contain:
 *   - the contract contains a literal "OR" alternative-clause marker
 *     (template-artefact, blocker)
 *   - it uses UK-only "qualifying earnings" terminology in an Irish contract
 *     (terminology, high)
 *   - it discusses pensions but never names the Automatic Enrolment Retirement
 *     Savings System Act 2024 nor the Pensions Act 1990 (missing-statute,
 *     medium)
 *
 * If anyone weakens the rule YAMLs or the detector wiring such that any of
 * these stop firing on the canonical excerpt, this test fails immediately.
 *
 * The full RAG round-trip (LLM completeStructured + embedding retrieval) is
 * out of scope here — that needs a live model and is exercised by the manual
 * acceptance run noted in the verify TODO.
 */
describe('Golden answer (synthetic Irish contract — pension clause)', () => {
  let detector: RuleDetectorService;
  let merger: MergeService;

  beforeAll(() => {
    // Use the real on-disk rule loader so we cover the same YAML the prod
    // pipeline ships. RED_FLAG_RULES_VERSION defaults to v1.
    const stubConfig = { get: () => undefined } as unknown as ConfigService;
    const loader = new RuleLoaderService(stubConfig);
    detector = new RuleDetectorService(loader);
    merger = new MergeService();
  });

  /**
   * Synthetic Clause 7 ("Retirement Savings") for a fictional employer. The
   * literal "OR" line imitates a template alternative-clause marker left in
   * a draft by mistake.
   */
  const PENSION_EXCERPT = `
7. Retirement Savings

7.1 The Employee may join the retirement savings plan offered by the Employer on the terms below.

7.1.1 The Employer will contribute 4% of the Employee's qualifying earnings to the plan every month.

7.1.2 The Employee may add voluntary contributions of up to 2% of qualifying earnings.

OR

7.1.3 The Employer will enrol the Employee in a group retirement plan chosen by the Employer.

7.2 No further pension benefits apply other than those described in this Clause 7.
`.trim();

  it('flags the literal OR template-artefact as blocker', () => {
    const hits = detector.detect(
      {
        text: PENSION_EXCERPT,
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '7' }],
        jurisdiction: 'IE',
      },
      'v1',
    );
    const orHit = hits.find(
      (h) => h.issue.category === 'template-artefact' && /OR/i.test(h.issue.message),
    );
    expect(orHit).toBeDefined();
    expect(orHit!.issue.severity).toBe('blocker');
  });

  it('flags "qualifying earnings" as wrong-jurisdiction terminology', () => {
    const hits = detector.detect(
      {
        text: PENSION_EXCERPT,
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '7' }],
        jurisdiction: 'IE',
      },
      'v1',
    );
    const termHit = hits.find(
      (h) =>
        h.issue.category === 'terminology' &&
        /qualifying earnings/i.test(h.issue.message),
    );
    expect(termHit).toBeDefined();
    expect(termHit!.issue.severity).toBe('high');
    expect(termHit!.issue.legislationRef).toMatch(
      /Automatic Enrolment.*2024/,
    );
  });

  it('flags missing AE Act 2024 / Pensions Act 1990 reference', () => {
    const hits = detector.detect(
      {
        text: PENSION_EXCERPT,
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '7' }],
        jurisdiction: 'IE',
      },
      'v1',
    );
    const missing = hits.find((h) => h.issue.category === 'missing-statute');
    expect(missing).toBeDefined();
    expect(missing!.issue.message).toMatch(/no Irish pensions statute/i);
  });

  it('does NOT fire the missing-statute rule when the contract names the AE Act', () => {
    const fixed = PENSION_EXCERPT.replace(
      'No further pension benefits',
      'The Company complies with the Automatic Enrolment Retirement Savings System Act 2024. No further pension benefits',
    );
    const hits = detector.detect(
      {
        text: fixed,
        chunks: [{ text: fixed, clauseNumber: '7' }],
        jurisdiction: 'IE',
      },
      'v1',
    );
    expect(hits.find((h) => h.issue.category === 'missing-statute')).toBeUndefined();
  });

  it('end-to-end: detector + merge produces all three expected issues, sorted by severity', () => {
    const hits = detector.detect(
      {
        text: PENSION_EXCERPT,
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '7' }],
        jurisdiction: 'IE',
      },
      'v1',
    );
    const merged = merger.merge({
      ruleIssues: hits.map((h) => h.issue),
      llmIssues: [],
    });
    const categories = merged.map((i) => i.category);
    expect(categories).toEqual(
      expect.arrayContaining([
        'template-artefact',
        'terminology',
        'missing-statute',
      ]),
    );
    // First issue is the worst severity (blocker — the literal OR).
    expect(merged[0].severity).toBe('blocker');
  });
});
