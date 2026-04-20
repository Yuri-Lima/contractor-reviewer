import { Logger } from '@nestjs/common';
import { WebSearchService } from './web-search.service';

type EnvOverrides = Record<string, string | undefined>;

function buildService(env: EnvOverrides = {}): WebSearchService {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as { get: jest.Mock };
  return new WebSearchService(config as never);
}

/** Build a minimal `Response` stub matching the subset of the fetch API the service uses. */
function fakeResponse(
  body: unknown,
  opts: { status?: number; ok?: boolean } = {},
): Response {
  const status = opts.status ?? 200;
  const ok = opts.ok ?? status < 400;
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('WebSearchService', () => {
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      // delete to restore any test-local mock state cleanly
      (globalThis as { fetch?: unknown }).fetch = undefined;
    }
  });

  describe('isEnabled', () => {
    it('is disabled when WEB_SEARCH_ENABLED is unset', () => {
      const svc = buildService({ TAVILY_API_KEY: 'k' });
      expect(svc.isEnabled()).toBe(false);
    });

    it('is disabled when WEB_SEARCH_ENABLED=on but no api key is configured', () => {
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on' });
      expect(svc.isEnabled()).toBe(false);
    });

    it('is enabled when both WEB_SEARCH_ENABLED=on and TAVILY_API_KEY are present', () => {
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      expect(svc.isEnabled()).toBe(true);
    });

    it('accepts on/true/1 as truthy values', () => {
      for (const v of ['on', 'true', '1', 'TRUE']) {
        const svc = buildService({ WEB_SEARCH_ENABLED: v, TAVILY_API_KEY: 'k' });
        expect(svc.isEnabled()).toBe(true);
      }
    });
  });

  describe('search()', () => {
    it('returns [] without calling fetch when the service is disabled', async () => {
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({});
      const results = await svc.search('pension');
      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns [] for an empty query without spending budget', async () => {
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const before = svc.remainingBudget();
      await svc.search('   ');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(svc.remainingBudget()).toBe(before);
    });

    it('maps Tavily results to WebSearchResult and clamps to free-tier 5 results', async () => {
      const tavilyHits = Array.from({ length: 8 }, (_, i) => ({
        title: `t${i}`,
        url: `https://example.com/${i}`,
        content: `snippet ${i}`,
        score: 0.9 - i * 0.1,
      }));
      const fetchMock = jest
        .fn()
        .mockResolvedValue(fakeResponse({ results: tavilyHits }));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const results = await svc.search('pension', { jurisdiction: 'IE' });

      expect(results).toHaveLength(5);
      expect(results[0]).toEqual({
        title: 't0',
        url: 'https://example.com/0',
        snippet: 'snippet 0',
        score: 0.9,
      });

      // Verify the request body is OpenAI-compatible Tavily params.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0];
      const body = JSON.parse((init as { body: string }).body);
      expect(body.api_key).toBe('k');
      expect(body.search_depth).toBe('basic');
      expect(body.max_results).toBe(5);
      // Tier 1: jurisdiction expanded from ISO code to country name.
      expect(body.query).toContain('pension');
      expect(body.query).toContain('Ireland');
      expect(body.query).not.toMatch(/\bIE\b/);
      expect(body.query).toMatch(/law \d{4}$/);
    });

    it('returns [] (and warns) on HTTP 429 rate limit', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(fakeResponse({}, { status: 429, ok: false }));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const results = await svc.search('x');
      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns [] (and warns) on HTTP 402 credits exhausted', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(fakeResponse({}, { status: 402, ok: false }));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const results = await svc.search('x');
      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns [] when fetch throws (network error)', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const results = await svc.search('x');
      expect(results).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
    });

    it('returns [] when monthly budget is exhausted (without calling fetch)', async () => {
      const fetchMock = jest.fn();
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({
        WEB_SEARCH_ENABLED: 'on',
        TAVILY_API_KEY: 'k',
        WEB_SEARCH_MONTHLY_BUDGET: '0',
      });
      const results = await svc.search('x');
      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('decrements remainingBudget on each successful call', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(fakeResponse({ results: [] }));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({
        WEB_SEARCH_ENABLED: 'on',
        TAVILY_API_KEY: 'k',
        WEB_SEARCH_MONTHLY_BUDGET: '3',
      });
      expect(svc.remainingBudget()).toBe(3);
      await svc.search('a');
      expect(svc.remainingBudget()).toBe(2);
      await svc.search('b');
      expect(svc.remainingBudget()).toBe(1);
    });

    it('drops Tavily hits without a url or title to avoid garbage citations', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        fakeResponse({
          results: [
            { title: 'good', url: 'https://x', content: 's' },
            { url: 'https://y' }, // no title
            { title: 'no-url', content: 's' },
            { title: 'good2', url: 'https://z' },
          ],
        }),
      );
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      const results = await svc.search('x');
      expect(results.map((r) => r.url)).toEqual([
        'https://x',
        'https://z',
      ]);
    });
  });

  describe('query enrichment', () => {
    /**
     * Helper: spin up an enabled service, capture the outgoing fetch body for
     * the supplied options, return the `query` field. Saves boilerplate per test.
     */
    async function captureQuery(
      query: string,
      options?: Parameters<WebSearchService['search']>[1],
    ): Promise<string> {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(fakeResponse({ results: [] }));
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
      const svc = buildService({ WEB_SEARCH_ENABLED: 'on', TAVILY_API_KEY: 'k' });
      await svc.search(query, options);
      const [, init] = fetchMock.mock.calls[0];
      return JSON.parse((init as { body: string }).body).query as string;
    }

    describe('jurisdiction expansion (Tier 1)', () => {
      it('expands country ISO code to canonical English name', async () => {
        const q = await captureQuery('pension', { jurisdiction: 'IE' });
        expect(q).toContain('Ireland');
        expect(q).not.toMatch(/\bIE\b/);
      });

      it('expands all known country codes to their English names', async () => {
        const cases: Array<[string, string]> = [
          ['GB', 'United Kingdom'],
          ['DE', 'Germany'],
          ['FR', 'France'],
          ['BR', 'Brazil'],
          ['US', 'United States'],
          ['EU', 'European Union'],
        ];
        for (const [code, name] of cases) {
          const q = await captureQuery('clause', { jurisdiction: code });
          expect(q).toContain(name);
        }
      });

      it('expands US-state subdivision codes to "<state> <country>"', async () => {
        const q = await captureQuery('arbitration', { jurisdiction: 'US-CA' });
        expect(q).toContain('California');
        expect(q).toContain('United States');
      });

      it('expands BR-state subdivision codes', async () => {
        const q = await captureQuery('rescisão', { jurisdiction: 'BR-SP' });
        expect(q).toContain('São Paulo');
        expect(q).toContain('Brazil');
      });

      it('falls back to the country name when the subdivision is unknown', async () => {
        const q = await captureQuery('q', { jurisdiction: 'US-WA' });
        expect(q).toContain('United States');
      });

      it('preserves an unknown country code verbatim instead of dropping it', async () => {
        const q = await captureQuery('q', { jurisdiction: 'XX' });
        expect(q).toContain('XX');
      });

      it('omits the jurisdiction tail entirely when no jurisdiction is provided', async () => {
        const q = await captureQuery('what is a NDA?');
        expect(q).toBe('what is a NDA?');
      });

      it('appends a year token for recency bias when jurisdiction is set', async () => {
        const q = await captureQuery('pension', { jurisdiction: 'IE' });
        expect(q).toMatch(/law \d{4}$/);
      });
    });

    describe('statute hints (Tier 2)', () => {
      it('appends statute hints between the user query and the jurisdiction tail', async () => {
        const q = await captureQuery('pension contributions', {
          jurisdiction: 'IE',
          statuteHints: ['Pensions Act 1990'],
        });
        // Order matters for relevance: user query first, then anchors, then jurisdiction.
        const userIdx = q.indexOf('pension contributions');
        const hintIdx = q.indexOf('Pensions Act 1990');
        const jurIdx = q.indexOf('Ireland');
        expect(userIdx).toBeGreaterThanOrEqual(0);
        expect(hintIdx).toBeGreaterThan(userIdx);
        expect(jurIdx).toBeGreaterThan(hintIdx);
      });

      it('caps statute hints at the first 2 entries even if more are supplied', async () => {
        const q = await captureQuery('q', {
          statuteHints: [
            'Pensions Act 1990',
            'Employment Equality Act 1998',
            'Industrial Relations Act 1990',
            'Workplace Relations Act 2015',
          ],
        });
        expect(q).toContain('Pensions Act 1990');
        expect(q).toContain('Employment Equality Act 1998');
        expect(q).not.toContain('Industrial Relations Act 1990');
        expect(q).not.toContain('Workplace Relations Act 2015');
      });

      it('truncates each statute hint to 40 chars to keep the query lean', async () => {
        const longHint = 'Very Long Statute Name Of Some Act Of 2020 With Even More Words';
        const q = await captureQuery('q', { statuteHints: [longHint] });
        // The whole long hint must NOT appear; the truncated prefix must.
        expect(q).not.toContain(longHint);
        expect(q).toContain(longHint.slice(0, 40));
      });

      it('deduplicates statute hints case-insensitively', async () => {
        const q = await captureQuery('q', {
          statuteHints: ['Pensions Act 1990', 'PENSIONS ACT 1990', 'pensions act 1990'],
        });
        // Should appear exactly once (count occurrences of the first canonical form).
        const matches = q.match(/Pensions Act 1990/g) ?? [];
        expect(matches.length).toBe(1);
      });

      it('drops empty / whitespace / non-string hints silently', async () => {
        const q = await captureQuery('q', {
          statuteHints: [
            '   ',
            '',
            // @ts-expect-error — defending the runtime contract against bad callers
            null,
            // @ts-expect-error — defending the runtime contract against bad callers
            undefined,
            'Real Act 2020',
          ],
        });
        expect(q).toContain('Real Act 2020');
      });

      it('includes statute hints even when no jurisdiction is provided', async () => {
        const q = await captureQuery('q', {
          statuteHints: ['Pensions Act 1990'],
        });
        expect(q).toContain('Pensions Act 1990');
        // No jurisdiction → no "law <year>" suffix.
        expect(q).not.toMatch(/law \d{4}$/);
      });

      it('returns the bare query when both jurisdiction and hints are empty', async () => {
        const q = await captureQuery('what is a force majeure clause?', {
          statuteHints: [],
        });
        expect(q).toBe('what is a force majeure clause?');
      });
    });
  });
});
