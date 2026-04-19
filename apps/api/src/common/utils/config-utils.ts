import { Logger } from '@nestjs/common';

const log = new Logger('ConfigUtils');

/**
 * Parse an integer env var with bounds checking and safe fallback.
 *
 * Default bounds (`min = 1`, `max = 100`) are tuned for the initial RAG
 * retrieval-tuning use case (top_k, citation caps — values that must be
 * positive integers). They are NOT universal:
 *
 * - If `0` is a valid input (e.g. "max retries = 0 means disabled",
 *   "batch size = 0 means single-item processing"), pass `{ min: 0 }`.
 * - If negative values are valid (e.g. score offsets), pass `{ min: -X }`.
 * - If your config can legitimately exceed 100 (e.g. ports, timeouts in ms),
 *   raise `max` explicitly.
 *
 * Always pass explicit bounds for non-RAG callers rather than relying on
 * the defaults — the defaults will silently reject perfectly valid values.
 *
 * Behavior:
 * - Empty / missing input → returns `fallback` silently.
 * - Out-of-range or non-numeric input → WARN log + returns `fallback`.
 * - Above `max` → WARN log + clamped to `max` (does NOT use fallback).
 */
export function parseEnvInt(
  name: string,
  raw: string | undefined,
  fallback: number,
  opts: { min?: number; max?: number } = {},
): number {
  const { min = 1, max = 100 } = opts;
  if (raw == null || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min) {
    log.warn(
      `${name}="${raw}" invalid (must be integer >= ${min}). Using default ${fallback}.`,
    );
    return fallback;
  }
  if (n > max) {
    log.warn(`${name}=${n} exceeds max ${max}. Clamping to ${max}.`);
    return max;
  }
  return n;
}

/**
 * Parse a float env var with bounds checking and safe fallback.
 *
 * Default bounds (`min = 0`, `max = 1`) are tuned for similarity / probability
 * scores — the initial RAG use case (RAG_SIMILARITY_FLOOR). They are NOT
 * universal:
 *
 * - For values outside `0..1` (rate multipliers > 1, negative offsets,
 *   temperatures, etc.), pass explicit `{ min, max }` bounds.
 * - Out-of-range inputs use the fallback (no clamping for floats — clamping
 *   a 1.5 to 1.0 silently corrupts the operator's intent in a way that's
 *   hard to debug; we'd rather warn loudly and use the documented default).
 */
export function parseEnvFloat(
  name: string,
  raw: string | undefined,
  fallback: number,
  opts: { min?: number; max?: number } = {},
): number {
  const { min = 0, max = 1 } = opts;
  if (raw == null || raw === '') return fallback;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < min || n > max) {
    log.warn(
      `${name}="${raw}" invalid (must be ${min}..${max}). Using default ${fallback}.`,
    );
    return fallback;
  }
  return n;
}
