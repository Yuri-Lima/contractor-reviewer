import {
  assertSynchronizeSafe,
  TypeOrmSynchronizeForbiddenError,
} from './typeorm-sync-guard';
import { resolveSynchronize } from '../../typeorm.options';

describe('assertSynchronizeSafe (migration safety)', () => {
  it('resolveSynchronize enables sync only for development when flag unset', () => {
    expect(resolveSynchronize('development', undefined)).toBe(true);
    expect(resolveSynchronize('production', undefined)).toBe(false);
    expect(resolveSynchronize('production', 'true')).toBe(true); // misconfig path
  });

  it('production misconfig (sync true via env) is rejected by the guard', () => {
    const sync = resolveSynchronize('production', 'true');
    expect(sync).toBe(true);
    expect(() => assertSynchronizeSafe(sync, 'production')).toThrow(
      TypeOrmSynchronizeForbiddenError,
    );
  });

  it('throws when synchronize is true in production', () => {
    expect(() => assertSynchronizeSafe(true, 'production')).toThrow(
      TypeOrmSynchronizeForbiddenError,
    );
    expect(() => assertSynchronizeSafe(true, 'production')).toThrow(
      /synchronize:true is forbidden/i,
    );
  });

  it('throws when synchronize is true in prod alias', () => {
    expect(() => assertSynchronizeSafe(true, 'prod')).toThrow(
      TypeOrmSynchronizeForbiddenError,
    );
  });

  it('throws for mixed-case PRODUCTION', () => {
    expect(() => assertSynchronizeSafe(true, 'Production')).toThrow(
      TypeOrmSynchronizeForbiddenError,
    );
  });

  it('allows synchronize:true in development (explicit non-prod)', () => {
    expect(() => assertSynchronizeSafe(true, 'development')).not.toThrow();
  });

  it('allows synchronize:true when NODE_ENV is undefined (non-prod default)', () => {
    expect(() => assertSynchronizeSafe(true, undefined)).not.toThrow();
  });

  it('never throws when synchronize is false, even in production', () => {
    expect(() => assertSynchronizeSafe(false, 'production')).not.toThrow();
  });

  it('exposes the bug: a misconfigured env enabling sync in prod must hard-fail', () => {
    // Simulates: operator sets TYPEORM_SYNCHRONIZE=true while NODE_ENV=production
    const misconfiguredSynchronize = true;
    const nodeEnv = 'production';
    expect(() =>
      assertSynchronizeSafe(misconfiguredSynchronize, nodeEnv),
    ).toThrow(TypeOrmSynchronizeForbiddenError);
  });
});
