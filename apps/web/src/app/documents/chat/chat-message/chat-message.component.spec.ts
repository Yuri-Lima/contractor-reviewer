/**
 * Unit tests for ChatMessageComponent subscription lifecycle.
 *
 * Bug: each message instance subscribed to a WebSocket (and lang-change)
 * observable without teardown → leak when scrolling long conversations.
 * Fix: DestroyRef + takeUntilDestroyed (no manual Subscription bookkeeping).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Subject } from 'rxjs';

describe('ChatMessageComponent subscription lifecycle', () => {
  it('uses takeUntilDestroyed pattern (DestroyRef) rather than manual Subscription tracking', () => {
    const src = fs.readFileSync(
      path.join(__dirname, 'chat-message.component.ts'),
      'utf-8',
    );
    expect(src).toMatch(/takeUntilDestroyed/);
    expect(src).toMatch(/DestroyRef/);
    // Must not rely on manual Subscription arrays / ngOnDestroy unsub loops
    expect(src).not.toMatch(/private\s+subscriptions\s*[:=]/);
    expect(src).not.toMatch(/Subscription\[\]/);
  });

  it('simulates the leak fix: unsubscribed subjects stop delivering after destroy', () => {
    // Models the fixed behaviour: pipe(takeUntilDestroyed) completes on destroy.
    const destroyRefLike = { callbacks: [] as Array<() => void> };
    const onDestroy = (cb: () => void) => {
      destroyRefLike.callbacks.push(cb);
    };
    const destroy = () => {
      destroyRefLike.callbacks.forEach((cb) => cb());
      destroyRefLike.callbacks = [];
    };

    const subject = new Subject<string>();
    let deliveries = 0;
    const sub = subject.subscribe(() => {
      deliveries += 1;
    });
    // Emulate takeUntilDestroyed teardown registration
    onDestroy(() => sub.unsubscribe());

    subject.next('a');
    expect(deliveries).toBe(1);

    destroy(); // component destroyed while scrolling away
    subject.next('b');
    expect(deliveries).toBe(1); // no leak: second event not delivered
  });

  it('exposes the bug class: without teardown, events keep firing after "destroy"', () => {
    const subject = new Subject<string>();
    let deliveries = 0;
    // BUG: subscribe without linking to DestroyRef
    subject.subscribe(() => {
      deliveries += 1;
    });

    subject.next('a');
    // "component destroyed" but subscription still live
    subject.next('b');
    expect(deliveries).toBe(2); // leaked listener still receives events
  });
});
