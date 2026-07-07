import { waitForReady } from './wait-for-ready';

describe('waitForReady (E2E auth race guard)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('resolves when health returns ok', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    }) as unknown as typeof fetch;

    await expect(
      waitForReady({ timeoutMs: 2000, pollIntervalMs: 10 }),
    ).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('retries until health succeeds (exposes the race without a wait)', async () => {
    let calls = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error('ECONNREFUSED');
      }
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }) as unknown as typeof fetch;

    await waitForReady({ timeoutMs: 2000, pollIntervalMs: 10 });
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('throws after timeout when API never becomes ready', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    await expect(
      waitForReady({ timeoutMs: 80, pollIntervalMs: 20 }),
    ).rejects.toThrow(/API not ready/);
  });
});
