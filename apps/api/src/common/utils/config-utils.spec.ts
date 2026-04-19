import { Logger } from '@nestjs/common';
import { parseEnvFloat, parseEnvInt } from './config-utils';

describe('config-utils', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      /* swallow during tests */
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('parseEnvInt', () => {
    it('returns fallback when env var is undefined', () => {
      expect(parseEnvInt('X', undefined, 7)).toBe(7);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('returns fallback when env var is empty string', () => {
      expect(parseEnvInt('X', '', 7)).toBe(7);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('parses a valid positive integer', () => {
      expect(parseEnvInt('X', '12', 7)).toBe(12);
    });

    it('falls back and warns on non-numeric input', () => {
      expect(parseEnvInt('X', 'abc', 7)).toBe(7);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back and warns on negative input (default min=1)', () => {
      expect(parseEnvInt('X', '-3', 7)).toBe(7);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('clamps and warns when input exceeds max', () => {
      expect(parseEnvInt('X', '200', 7, { max: 50 })).toBe(50);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('respects custom min override (allowing 0)', () => {
      expect(parseEnvInt('X', '0', 7, { min: 0 })).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('respects custom min above default (rejects 1 when min=2)', () => {
      expect(parseEnvInt('X', '1', 7, { min: 2 })).toBe(7);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    /**
     * Documented-default regression guard.
     * The JSDoc on parseEnvInt explicitly warns that `min` defaults to 1
     * and that callers needing 0 must pass `{ min: 0 }`. This test pins
     * that contract: a future "helpful" PR that flips the default to 0
     * will break this test and force a docs/changelog discussion.
     */
    describe('regression: default min=1 contract', () => {
      it('rejects "0" when min default is in effect', () => {
        expect(parseEnvInt('X', '0', 5)).toBe(5);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });

      it('accepts "0" cleanly when caller opts in via { min: 0 }', () => {
        expect(parseEnvInt('X', '0', 5, { min: 0 })).toBe(0);
        expect(warnSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('parseEnvFloat', () => {
    it('returns fallback when env var is undefined', () => {
      expect(parseEnvFloat('X', undefined, 0.5)).toBe(0.5);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('returns fallback when env var is empty string', () => {
      expect(parseEnvFloat('X', '', 0.5)).toBe(0.5);
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('parses a valid float in 0..1', () => {
      expect(parseEnvFloat('X', '0.7', 0.5)).toBeCloseTo(0.7);
    });

    it('accepts boundary 0', () => {
      expect(parseEnvFloat('X', '0', 0.5)).toBe(0);
    });

    it('accepts boundary 1', () => {
      expect(parseEnvFloat('X', '1', 0.5)).toBe(1);
    });

    it('falls back and warns on non-numeric input', () => {
      expect(parseEnvFloat('X', 'abc', 0.5)).toBe(0.5);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back and warns on negative input', () => {
      expect(parseEnvFloat('X', '-0.1', 0.5)).toBe(0.5);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('falls back and warns on input above max=1', () => {
      expect(parseEnvFloat('X', '1.5', 0.5)).toBe(0.5);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('respects custom min/max bounds', () => {
      expect(parseEnvFloat('X', '5', 1, { min: 0, max: 10 })).toBe(5);
      expect(parseEnvFloat('X', '15', 1, { min: 0, max: 10 })).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Behavior-asymmetry guard.
   * parseEnvInt clamps on overshoot (preserves operator intent within reason).
   * parseEnvFloat falls back on out-of-range (avoids silently corrupting
   * a 1.5 to 1.0 in a way that's hard to debug). This asymmetry is
   * deliberate and documented in both JSDoc blocks. This test pins the
   * contract so a future "normalize the inconsistency" refactor fails loudly.
   */
  describe('regression: int clamps, float falls back (deliberate asymmetry)', () => {
    it('parseEnvInt clamps to max', () => {
      expect(parseEnvInt('X', '999', 5, { max: 50 })).toBe(50);
    });

    it('parseEnvFloat falls back (does NOT clamp)', () => {
      expect(parseEnvFloat('X', '1.5', 0.5)).toBe(0.5);
    });
  });
});
