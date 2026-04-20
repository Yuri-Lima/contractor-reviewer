import { stalenessWarning } from './seed-legal-corpus';

describe('seed-legal-corpus stalenessWarning', () => {
  const NOW = new Date('2026-04-19T00:00:00Z');

  it('returns null for a fresh lastVerified (within 180 days)', () => {
    const fresh = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(stalenessWarning('ie/x.yaml', { lastVerified: fresh }, NOW)).toBeNull();
  });

  it('warns when lastVerified is missing', () => {
    const w = stalenessWarning(
      'ie/x.yaml',
      { lastVerified: '' as unknown as string },
      NOW,
    );
    expect(w).toMatch(/missing lastVerified/);
  });

  it('warns when lastVerified is unparseable', () => {
    const w = stalenessWarning(
      'ie/x.yaml',
      { lastVerified: 'not-a-date' },
      NOW,
    );
    expect(w).toMatch(/invalid lastVerified/);
  });

  it('warns when lastVerified is older than 180 days, with the day count', () => {
    const stale = new Date(NOW.getTime() - 200 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const w = stalenessWarning('ie/x.yaml', { lastVerified: stale }, NOW);
    expect(w).toMatch(/200 days old/);
    expect(w).toMatch(/please re-verify/);
  });

  it('considers exactly 180 days as still fresh (boundary check)', () => {
    const exactly180 = new Date(NOW.getTime() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    expect(
      stalenessWarning('ie/x.yaml', { lastVerified: exactly180 }, NOW),
    ).toBeNull();
  });
});
