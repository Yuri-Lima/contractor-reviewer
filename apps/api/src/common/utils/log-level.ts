/**
 * Parse LOG_LEVEL env and return NestJS logger config.
 * - "off" | "silent" | "none" -> false (disable all)
 * - "error" | "warn" | "log" | "debug" | "verbose" -> cascading levels
 * - Default: "log" in production, "debug" in development
 */
const ORDER = ['verbose', 'debug', 'log', 'warn', 'error'] as const;
export type LogLevel = (typeof ORDER)[number];

export function getLoggerConfig(): LogLevel[] | false {
  const raw = (process.env['LOG_LEVEL'] || '').toLowerCase().trim();
  if (['off', 'silent', 'none', 'false', '0'].includes(raw)) {
    return false;
  }
  const level =
    raw || (process.env['NODE_ENV'] === 'production' ? 'log' : 'debug');
  const normalized = level === 'info' ? 'log' : level;
  const idx = ORDER.indexOf(normalized as LogLevel);
  if (idx === -1) return ['log', 'warn', 'error'];
  return [...ORDER.slice(idx)];
}
