import { RuleDetectorService } from './rule-detector.service';
import type { RuleLoaderService } from './rule-loader.service';
import type { RawRuleFile } from './rule-types';

/**
 * Table-driven specs covering the four shipped rule categories
 * (template-artefact, terminology, missing-statute, deprecated-term).
 *
 * We avoid touching the real YAML on disk by stubbing `RuleLoaderService.load`
 * with each scenario's rule set inline — the detector's regex engine and
 * clauseRef enrichment are what we actually want to exercise.
 */
describe('RuleDetectorService', () => {
  let service: RuleDetectorService;
  let load: jest.Mock<RawRuleFile[], [string?]>;

  beforeEach(() => {
    load = jest.fn();
    const loader = {
      load,
      getActiveRulesVersion: jest.fn(),
    } as unknown as RuleLoaderService;
    service = new RuleDetectorService(loader);
  });

  it('flags bracketed placeholders, TBC markers, literal OR, and lorem ipsum', () => {
    load.mockReturnValue([
      {
        rulesVersion: 'v1',
        category: 'template-artefact',
        appliesTo: 'any',
        rules: [
          {
            id: 'bracketed-placeholder',
            pattern: '\\[[A-Z_]{2,}\\]',
            flags: 'g',
            severity: 'high',
            message: 'placeholder',
          },
          {
            id: 'tbc',
            pattern: '\\b(?:tbc|tbd)\\b',
            flags: 'gi',
            severity: 'high',
            message: 'tbc marker',
          },
          {
            id: 'alt-or',
            pattern: '^\\s*OR\\s*$',
            flags: 'm',
            severity: 'blocker',
            message: 'literal OR',
          },
          {
            id: 'lorem',
            pattern: 'lorem ipsum',
            flags: 'gi',
            severity: 'blocker',
            message: 'filler text',
          },
        ],
      },
    ]);

    const text =
      '9.1 Pension contributions are [XX]% of qualifying earnings.\n' +
      '9.2 Annual leave: tbc.\n' +
      'OR\n' +
      'Lorem ipsum dolor sit amet.\n';
    const hits = service.detect(
      { text, chunks: [{ text, clauseNumber: '9' }], jurisdiction: 'IE' },
      'v1',
    );
    const ids = hits.map((h) => h.ruleId).sort();
    expect(ids).toEqual(
      ['alt-or', 'bracketed-placeholder', 'lorem', 'tbc'].sort(),
    );
    const blockers = hits.filter((h) => h.issue.severity === 'blocker');
    expect(blockers.length).toBe(2);
  });

  it('emits a missing-statute issue when topic is present but no required pattern matches', () => {
    load.mockReturnValue([
      {
        rulesVersion: 'v1',
        category: 'missing-statute',
        appliesTo: 'jurisdiction:IE',
        rules: [
          {
            id: 'pension-without-ae-act',
            topicPattern: 'pension|retirement',
            requiredAnyPattern: [
              'Automatic Enrolment Retirement Savings System Act 2024',
              'Pensions Act 1990',
            ],
            severity: 'high',
            message: 'Pension clause without governing-statute reference.',
          },
        ],
      },
    ]);

    const text = '9.1 Pension contributions are 5% of salary.';
    const hits = service.detect(
      { text, chunks: [{ text, clauseNumber: '9.1' }], jurisdiction: 'IE' },
      'v1',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].ruleId).toBe('pension-without-ae-act');
    expect(hits[0].issue.severity).toBe('high');
  });

  it('does NOT emit missing-statute when one required pattern is present', () => {
    load.mockReturnValue([
      {
        rulesVersion: 'v1',
        category: 'missing-statute',
        appliesTo: 'jurisdiction:IE',
        rules: [
          {
            id: 'pension-without-ae-act',
            topicPattern: 'pension',
            requiredAnyPattern: ['Pensions Act 1990'],
            severity: 'high',
            message: 'missing',
          },
        ],
      },
    ]);

    const text = 'Pension is governed by the Pensions Act 1990 of Ireland.';
    const hits = service.detect(
      { text, chunks: [{ text }], jurisdiction: 'IE' },
      'v1',
    );
    expect(hits).toHaveLength(0);
  });

  it('skips rule files whose appliesTo jurisdiction does not match', () => {
    const file: RawRuleFile = {
      rulesVersion: 'v1',
      category: 'terminology',
      appliesTo: 'jurisdiction:IE',
      rules: [
        {
          id: 'qualifying-earnings',
          pattern: 'qualifying earnings',
          flags: 'gi',
          severity: 'medium',
          message: 'UK pensions terminology',
        },
      ],
    };

    const text = 'Pension contributions are 5% of qualifying earnings.';

    load.mockReturnValue([file]);
    const hitsForUk = service.detect(
      { text, chunks: [{ text }], jurisdiction: 'GB' },
      'v1',
    );
    expect(hitsForUk).toHaveLength(0);

    load.mockReturnValue([file]);
    const hitsForIe = service.detect(
      { text, chunks: [{ text }], jurisdiction: 'IE' },
      'v1',
    );
    expect(hitsForIe).toHaveLength(1);
  });

  it('annotates pattern hits with the chunk clauseNumber that contains the match offset', () => {
    load.mockReturnValue([
      {
        rulesVersion: 'v1',
        category: 'deprecated-term',
        appliesTo: 'any',
        rules: [
          {
            id: 'six-month-probation',
            pattern: '(?:six|6)[\\s-]month probation',
            flags: 'gi',
            severity: 'medium',
            message: 'Deprecated probation term',
          },
        ],
      },
    ]);

    const chunk1 = '8. Termination ...';
    const chunk2 =
      '11. Probation. The probation period is six month probation.';
    const text = `${chunk1}\n\n${chunk2}`;
    const hits = service.detect(
      {
        text,
        chunks: [
          { text: chunk1, clauseNumber: '8' },
          { text: chunk2, clauseNumber: '11' },
        ],
        jurisdiction: 'IE',
      },
      'v1',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].issue.clauseRef).toBe('11');
  });

  it('caps matches per rule at ~200 to prevent regex blowup', () => {
    load.mockReturnValue([
      {
        rulesVersion: 'v1',
        category: 'template-artefact',
        appliesTo: 'any',
        rules: [
          {
            id: 'foo',
            pattern: 'foo',
            flags: 'g',
            severity: 'low',
            message: 'foo',
          },
        ],
      },
    ]);

    const text = 'foo '.repeat(500);
    const hits = service.detect({ text, chunks: [{ text }] }, 'v1');
    expect(hits.length).toBeLessThanOrEqual(201);
  });
});
