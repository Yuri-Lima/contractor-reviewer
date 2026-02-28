/**
 * Combines multiple AbortSignals into one that aborts when any input signal aborts.
 * Use instead of AbortSignal.any() in Node.js due to reported memory-leak and
 * reliability issues.
 */
export function combineAbortSignals(
  signals: (AbortSignal | undefined | null)[],
): AbortSignal {
  const controller = new AbortController();
  const valid = signals.filter((s): s is AbortSignal => !!s);

  valid.forEach((s) => {
    if (s.aborted) {
      controller.abort(s.reason);
      return;
    }
    s.addEventListener(
      'abort',
      () => controller.abort(s.reason),
      { once: true },
    );
  });

  return controller.signal;
}
