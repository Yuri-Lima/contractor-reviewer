import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { RedisOptions } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * Build Redis connection options from ConfigService.
 * Same config as BullMQ (REDIS_URL or REDIS_HOST/REDIS_PORT).
 */
function buildRedisOptions(configService: ConfigService): RedisOptions {
  const base: RedisOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ for Worker blocking commands (BRPOP)
  };
  const redisUrl = configService.get<string>('REDIS_URL');
  if (redisUrl) {
    const url = new URL(redisUrl);
    return {
      ...base,
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      password: url.password || undefined,
    };
  }
  return {
    ...base,
    host: configService.get<string>('REDIS_HOST', 'localhost'),
    port: configService.get<number>('REDIS_PORT', 6379),
  };
}

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (configService: ConfigService): IORedis => {
    const opts = buildRedisOptions(configService);
    return new IORedis(opts);
  },
  inject: [ConfigService],
};
