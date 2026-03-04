import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { REDIS_CLIENT, redisClientProvider } from './redis.provider';

/**
 * Provides shared REDIS_CLIENT (IORedis instance) for BullMQ and RAG cache.
 * Must be imported in BullModule.forRootAsync so Bull can resolve the connection.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisClientProvider],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
