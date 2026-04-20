import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseEnvInt } from '../common/utils/config-utils';

/**
 * One web search hit returned to RAG. Intentionally provider-agnostic so a
 * future Brave/Google adapter can drop in behind the same shape.
 */
export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Provider-supplied relevance score (0..1 for Tavily). May be undefined. */
  score?: number;
}

export interface WebSearchOptions {
  /** Jurisdiction code (e.g. "IE", "US-CA") used to bias the query toward local sources. */
  jurisdiction?: string;
  /**
   * Optional statute / regulator names mined from the retrieved RAG context
   * (e.g. `["Pensions Act 1990"]`). Up to 2 are appended to the query so
   * Tavily can anchor on authoritative `.gov` sources instead of generic
   * explainers. Each hint is trimmed to {@link MAX_STATUTE_HINT_CHARS}.
   *
   * Safety: callers MUST only pass short, neutral identifiers (act names,
   * regulator names). Never pass raw chunk text — that would leak contract
   * content (party names, salaries) to the third-party Tavily API.
   */
  statuteHints?: string[];
  /** Hard cap on results. Always clamped to the free-tier max (5). */
  maxResults?: number;
  signal?: AbortSignal;
}

interface TavilyResponseHit {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResponseHit[];
  answer?: string;
}

/** Tavily free-tier hard limits (per their public docs as of 2026). */
const TAVILY_FREE_TIER_MAX_RESULTS = 5;
/** Hard cap on how many statute hints we forward to Tavily (relevance > recall). */
const MAX_STATUTE_HINTS = 2;
/** Max chars per individual statute hint. Anything longer is sliced — keeps the query lean. */
const MAX_STATUTE_HINT_CHARS = 40;
/**
 * Reverse map from ISO-3166-ish codes to canonical English names. Used in
 * {@link WebSearchService.enrichQuery} so Tavily sees `Ireland` instead of
 * `IE` (Tavily's lexical scoring treats two-letter codes as noise). Kept
 * small on purpose — only the jurisdictions our resolver can produce.
 */
const COUNTRY_NAME_BY_CODE: Record<string, string> = {
  IE: 'Ireland',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  PT: 'Portugal',
  BR: 'Brazil',
  US: 'United States',
  CA: 'Canada',
  NL: 'Netherlands',
  CH: 'Switzerland',
  LU: 'Luxembourg',
  SG: 'Singapore',
  HK: 'Hong Kong',
  AU: 'Australia',
  EU: 'European Union',
};
/**
 * Reverse map for `<COUNTRY>-<SUBDIVISION>` codes the resolver can emit.
 * Mirrors `JurisdictionResolverService` in `apps/api/src/rag/`. Kept inline
 * (rather than importing from the resolver) to avoid coupling
 * `WebSearchModule` to the RAG namespace.
 */
const SUBDIVISION_NAME_BY_CODE: Record<string, string> = {
  'US-CA': 'California',
  'US-NY': 'New York',
  'US-TX': 'Texas',
  'US-FL': 'Florida',
  'US-DE': 'Delaware',
  'BR-SP': 'São Paulo',
  'BR-RJ': 'Rio de Janeiro',
  'BR-MG': 'Minas Gerais',
  'BR-DF': 'Distrito Federal',
};
/**
 * Minimum gap (ms) between outbound Tavily calls. 100 RPM = 1 call / 600ms,
 * so we use exactly 600ms to stay safely under the limit even with bursty
 * traffic. Cheap to enforce in-process; if we ever go multi-instance we
 * should move this to Redis.
 */
const MIN_GAP_BETWEEN_CALLS_MS = 600;
const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
/** Default per-request timeout. Tavily basic searches usually return < 2s. */
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

/**
 * Tavily-backed web search with built-in rate limiting, monthly budget, and
 * graceful degradation. Returns `[]` (never throws) on rate-limit, budget
 * exhaustion, missing API key, or transient HTTP errors so the RAG pipeline
 * can keep going without web context rather than failing the whole request.
 *
 * Free tier we're targeting:
 * - 1,000 API credits / month (we cap at WEB_SEARCH_MONTHLY_BUDGET, default 900).
 * - 100 RPM dev keys (we throttle to one call per 600ms).
 * - 5 results / query max (we hard-cap, not just clamp the request).
 * - Basic search depth only.
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);
  private readonly apiKey: string | undefined;
  private readonly enabled: boolean;
  private readonly monthlyBudget: number;
  private readonly maxResultsConfig: number;

  /** Last outbound call timestamp (ms epoch). 0 = never called. */
  private lastCallAt = 0;
  /**
   * Calendar-month token for the in-memory budget counter. When the current
   * month differs we reset `callsThisMonth` to 0. Format: `YYYY-MM`.
   * In-memory only; restarting the API resets the counter, which is fine
   * for a single-instance dev/staging deployment. Multi-instance budgeting
   * needs Redis (out of scope for this PR).
   */
  private monthToken: string;
  private callsThisMonth = 0;
  /** Promise chain used to serialize calls so the rate-limit gap is honoured even under concurrent callers. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('TAVILY_API_KEY')?.trim() || undefined;
    const flag = (this.configService.get<string>('WEB_SEARCH_ENABLED') ?? 'off').toLowerCase();
    this.enabled = flag === 'on' || flag === 'true' || flag === '1';

    this.monthlyBudget = parseEnvInt(
      'WEB_SEARCH_MONTHLY_BUDGET',
      this.configService.get<string>('WEB_SEARCH_MONTHLY_BUDGET'),
      900,
      { min: 0, max: 100000 },
    );
    this.maxResultsConfig = parseEnvInt(
      'WEB_SEARCH_MAX_RESULTS',
      this.configService.get<string>('WEB_SEARCH_MAX_RESULTS'),
      TAVILY_FREE_TIER_MAX_RESULTS,
      { min: 1, max: TAVILY_FREE_TIER_MAX_RESULTS },
    );
    this.monthToken = WebSearchService.currentMonthToken();

    this.logger.log(
      `[WebSearchConfig] enabled=${this.enabled} hasApiKey=${Boolean(this.apiKey)} ` +
        `monthlyBudget=${this.monthlyBudget} maxResults=${this.maxResultsConfig}`,
    );
  }

  /** Whether the service is configured to perform searches at all. */
  isEnabled(): boolean {
    return this.enabled && Boolean(this.apiKey);
  }

  /** Remaining calls in the current calendar month (resets on month rollover). */
  remainingBudget(): number {
    this.maybeRollMonth();
    return Math.max(0, this.monthlyBudget - this.callsThisMonth);
  }

  /**
   * Search the web. Returns at most `maxResults` (capped at 5) results.
   * On any failure mode, returns `[]` and logs a warning — never throws.
   *
   * The query is enriched with jurisdiction + the current year so legal
   * questions tend to surface up-to-date local statutes instead of
   * generic explainers.
   */
  async search(
    query: string,
    options?: WebSearchOptions,
  ): Promise<WebSearchResult[]> {
    if (!this.isEnabled()) {
      return [];
    }
    const trimmed = query?.trim();
    if (!trimmed) return [];

    if (this.remainingBudget() <= 0) {
      this.logger.warn(
        `[WebSearch] monthly budget exhausted (${this.callsThisMonth}/${this.monthlyBudget}). Skipping search.`,
      );
      return [];
    }

    // Serialize through the chain so concurrent callers still respect the
    // 600ms gap. We attach our own task to whatever is currently pending.
    const task = this.chain.then(() => this.runSearch(trimmed, options));
    // Swallow rejections on the chain itself so one failure doesn't poison
    // future chained calls. The actual error is handled inside runSearch.
    this.chain = task.catch(() => undefined);
    return task;
  }

  private async runSearch(
    query: string,
    options?: WebSearchOptions,
  ): Promise<WebSearchResult[]> {
    await this.waitForRateLimit();

    const enrichedQuery = this.enrichQuery(
      query,
      options?.jurisdiction,
      options?.statuteHints,
    );
    const requestedMax = Math.min(
      options?.maxResults ?? this.maxResultsConfig,
      TAVILY_FREE_TIER_MAX_RESULTS,
    );

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      DEFAULT_REQUEST_TIMEOUT_MS,
    );
    const signals = options?.signal
      ? this.combineSignals([timeoutController.signal, options.signal])
      : timeoutController.signal;

    try {
      this.lastCallAt = Date.now();
      this.maybeRollMonth();
      this.callsThisMonth += 1;

      const response = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Tavily accepts the api_key in the body; sending the bearer is harmless and
          // future-proofs us if they switch to Authorization-only.
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: enrichedQuery,
          search_depth: 'basic',
          max_results: requestedMax,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: signals,
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          this.logger.warn(
            `[WebSearch] Tavily rate limit hit (429). Returning empty results to keep RAG flowing.`,
          );
        } else if (status === 401 || status === 403) {
          this.logger.warn(
            `[WebSearch] Tavily auth failure (${status}). Check TAVILY_API_KEY. Returning empty results.`,
          );
        } else if (status === 402) {
          this.logger.warn(
            `[WebSearch] Tavily credits exhausted (402). Returning empty results.`,
          );
        } else {
          this.logger.warn(`[WebSearch] Tavily HTTP ${status}. Returning empty results.`);
        }
        return [];
      }

      const body = (await response.json().catch(() => ({}))) as TavilyResponse;
      const hits = Array.isArray(body.results) ? body.results : [];
      const mapped: WebSearchResult[] = hits
        .filter((h): h is TavilyResponseHit & { url: string; title: string } =>
          Boolean(h?.url && h?.title),
        )
        .map((h) => ({
          title: h.title,
          url: h.url,
          snippet: (h.content ?? '').toString().trim(),
          ...(typeof h.score === 'number' ? { score: h.score } : {}),
        }))
        .slice(0, requestedMax);

      this.logger.log(
        `[WebSearch] tavily ok results=${mapped.length} budgetUsed=${this.callsThisMonth}/${this.monthlyBudget}`,
      );
      return mapped;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Abort is the most common "non-error error" — surface it at debug, the
      // upstream caller already knows the request was cancelled.
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.debug(`[WebSearch] aborted: ${msg}`);
      } else {
        this.logger.warn(`[WebSearch] request failed: ${msg}. Returning empty results.`);
      }
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Sleep until at least MIN_GAP_BETWEEN_CALLS_MS has elapsed since the last call. */
  private async waitForRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastCallAt;
    if (this.lastCallAt === 0 || elapsed >= MIN_GAP_BETWEEN_CALLS_MS) return;
    const wait = MIN_GAP_BETWEEN_CALLS_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  /**
   * Build the outbound Tavily query. Composition:
   *
   *   `<user query> [<statute hints…>] [<jurisdiction name>] law <year>`
   *
   * - The user's verbatim wording stays first so it dominates relevance.
   * - Statute hints (e.g. "Pensions Act 1990") anchor Tavily to the actual
   *   primary source and dramatically improve `.gov` recall.
   * - Jurisdiction is expanded ISO code → English name (`IE` → `Ireland`,
   *   `US-CA` → `California United States`) because Tavily's lexical layer
   *   ignores two-letter codes.
   * - Year token biases toward fresh content.
   *
   * Hints and jurisdiction are both optional and independently safe to omit.
   */
  private enrichQuery(
    query: string,
    jurisdiction?: string,
    statuteHints?: string[],
  ): string {
    const cleanedHints = this.normalizeStatuteHints(statuteHints);
    const jurisdictionTokens = this.expandJurisdiction(jurisdiction);

    if (cleanedHints.length === 0 && !jurisdictionTokens) return query;

    const parts: string[] = [query];
    for (const hint of cleanedHints) parts.push(hint);
    if (jurisdictionTokens) {
      parts.push(`${jurisdictionTokens} law ${new Date().getFullYear()}`);
    }
    return parts.join(' ');
  }

  /**
   * Expand an ISO code to a search-friendly name. `US-CA` → `California
   * United States` (state + country, both in plain English so Tavily can
   * weight them as keywords). Unknown codes are returned verbatim so we
   * degrade to today's behaviour rather than dropping the signal entirely.
   */
  private expandJurisdiction(code?: string): string {
    if (!code) return '';
    const trimmed = code.trim();
    if (!trimmed) return '';

    // Subdivision (e.g. "US-CA"): emit "<state> <country>" when both are known.
    if (trimmed.includes('-')) {
      const subdivision = SUBDIVISION_NAME_BY_CODE[trimmed];
      const [country] = trimmed.split('-');
      const countryName = COUNTRY_NAME_BY_CODE[country] ?? country;
      if (subdivision) return `${subdivision} ${countryName}`;
      // Unknown subdivision: fall back to the country name only.
      return countryName;
    }

    return COUNTRY_NAME_BY_CODE[trimmed] ?? trimmed;
  }

  /**
   * Normalize caller-supplied statute hints: trim, drop empties, dedupe
   * (case-insensitive), slice to {@link MAX_STATUTE_HINT_CHARS}, and cap
   * total count at {@link MAX_STATUTE_HINTS}. Returns `[]` for falsy input.
   */
  private normalizeStatuteHints(hints?: string[]): string[] {
    if (!Array.isArray(hints) || hints.length === 0) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of hints) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim().slice(0, MAX_STATUTE_HINT_CHARS);
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
      if (out.length >= MAX_STATUTE_HINTS) break;
    }
    return out;
  }

  private maybeRollMonth(): void {
    const now = WebSearchService.currentMonthToken();
    if (now !== this.monthToken) {
      this.logger.log(
        `[WebSearch] new month ${now} (was ${this.monthToken}); resetting budget counter from ${this.callsThisMonth}.`,
      );
      this.monthToken = now;
      this.callsThisMonth = 0;
    }
  }

  private static currentMonthToken(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Minimal AbortSignal combinator (Node 20 has AbortSignal.any but we keep a
   * fallback for older runtimes / tests with mocked globals).
   */
  private combineSignals(signals: AbortSignal[]): AbortSignal {
    const anyFn = (
      AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }
    ).any;
    if (typeof anyFn === 'function') return anyFn(signals);
    const controller = new AbortController();
    for (const s of signals) {
      if (s.aborted) {
        controller.abort();
        break;
      }
      s.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }
}
