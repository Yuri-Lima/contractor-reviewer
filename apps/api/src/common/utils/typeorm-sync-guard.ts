/**
 * Production safety guard for TypeORM `synchronize`.
 *
 * `synchronize: true` can drop/alter columns without migrations — catastrophic
 * for legal-document data. This guard must run at process startup whenever
 * TypeORM options are built so a misconfigured env var cannot enable it in prod.
 */
export class TypeOrmSynchronizeForbiddenError extends Error {
  constructor(nodeEnv: string) {
    super(
      `FATAL: TypeORM synchronize:true is forbidden when NODE_ENV=${nodeEnv}. ` +
        `Use migrations instead. Refusing to start to protect legal document data.`,
    );
    this.name = 'TypeOrmSynchronizeForbiddenError';
  }
}

/**
 * Throws if synchronize is enabled under a production-like NODE_ENV.
 * Safe to call with synchronize=false (no-op).
 */
export function assertSynchronizeSafe(
  synchronize: boolean,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): void {
  if (!synchronize) return;

  const env = (nodeEnv ?? '').trim().toLowerCase();
  const isProduction = env === 'production' || env === 'prod';

  if (isProduction) {
    throw new TypeOrmSynchronizeForbiddenError(env || 'production');
  }
}
