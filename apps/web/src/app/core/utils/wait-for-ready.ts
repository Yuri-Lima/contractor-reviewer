/**
 * Poll the API health endpoint until it responds OK (or timeout).
 * Prevents the E2E auth race where Playwright hits /auth before the API
 * has finished booting / seeding.
 */
const API_URL = process.env['E2E_API_URL'] || 'http://localhost:3000/api';
const DEFAULT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

export async function waitForReady(
  options: {
    apiUrl?: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  } = {},
): Promise<void> {
  const apiUrl = options.apiUrl ?? API_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
  const healthUrl = `${apiUrl.replace(/\/$/, '')}/health`;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        // Optionally ensure body looks healthy
        try {
          const body = (await res.json()) as { status?: string };
          if (body?.status && body.status !== 'ok' && body.status !== 'healthy') {
            lastError = new Error(`Unexpected health status: ${body.status}`);
          } else {
            return;
          }
        } catch {
          // Non-JSON 2xx is still fine — endpoint is up
          return;
        }
      } else {
        lastError = new Error(`Health check HTTP ${res.status}`);
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown');
  throw new Error(
    `API not ready after ${timeoutMs}ms (GET ${healthUrl}): ${detail}`,
  );
}
