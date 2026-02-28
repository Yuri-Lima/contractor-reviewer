/**
 * Returns a Promise that rejects with AbortError when the signal aborts.
 * Use with Promise.race([op, abortAsPromise(signal)]) for APIs that do not
 * natively support AbortSignal.
 */
export function abortAsPromise(signal: AbortSignal | undefined | null): Promise<never> {
  if (!signal) {
    return new Promise(() => {}); // Never resolves when no signal
  }
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
      once: true,
    });
  });
}
