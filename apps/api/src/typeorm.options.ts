import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { assertSynchronizeSafe } from './common/utils/typeorm-sync-guard';

/**
 * Resolve whether TypeORM schema sync is requested.
 * Prefer explicit TYPEORM_SYNCHRONIZE; fall back to legacy "true in development".
 * The production guard below is the real safety net — never rely on defaults alone.
 */
export function resolveSynchronize(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  explicit?: string | undefined,
): boolean {
  const flag = explicit ?? process.env.TYPEORM_SYNCHRONIZE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  // Historical behaviour: auto-sync only in development when unset
  return (nodeEnv ?? '').toLowerCase() === 'development';
}

export function typeOrmModuleOptions(): TypeOrmModuleOptions {
  const configService = new ConfigService();
  const nodeEnv = process.env.NODE_ENV;
  const synchronize = resolveSynchronize(nodeEnv);

  // HARD GUARD: refuse to boot if synchronize would run in production
  assertSynchronizeSafe(synchronize, nodeEnv);

  return {
    type: 'postgres',
    url: configService.get<string>('DATABASE_URL'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    // Prefer migrations; synchronize may be true only in non-prod (see guard)
    synchronize,
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
    extra: {
      // Enable pgvector extension
      max: 20,
    },
  };
}
