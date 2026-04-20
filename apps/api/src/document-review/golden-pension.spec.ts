import type { ConfigService } from '@nestjs/config';
import { RuleDetectorService } from './rules/rule-detector.service';
import { RuleLoaderService } from './rules/rule-loader.service';
import { MergeService } from './merge.service';

/**
 * Golden-answer pipeline test for the Peak PEO Ireland pension clause.
 *
 * Anchored on the original analysis the team did manually:
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
describe('Golden answer (Peak PEO Ireland — pension clause)', () => {
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
   * Faithful prose extract of Clause 9 ("Pension") from the Peak PEO Ireland
   * draft. The literal "OR" line is the template alternative-clause marker
   * the contract still ships with.
   */
  const PENSION_EXCERPT = `
9. Pension

9.1 The Worker shall be entitled to participate in the Company pension arrangements as set out below.

9.1.1 The Company shall make pension contributions equal to 5% of the Worker's qualifying earnings each pay period.

9.1.2 The Worker may elect to make additional voluntary contributions of up to 3% of qualifying earnings.

OR

9.1.3 The Company shall arrange for the Worker to be enrolled in the workplace pension scheme operated by the Company's pension provider.

9.2 No further pension benefits are payable beyond those set out in this Clause 9.
`.trim();

  it('flags the literal OR template-artefact as blocker', () => {
    const hits = detector.detect(
      {
        text: PENSION_EXCERPT,
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '9' }],
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
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '9' }],
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
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '9' }],
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
        chunks: [{ text: fixed, clauseNumber: '9' }],
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
        chunks: [{ text: PENSION_EXCERPT, clauseNumber: '9' }],
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
