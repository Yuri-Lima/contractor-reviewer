import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagCacheService } from './rag-cache.service';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [ConfigModule, QueueModule],
  providers: [RagCacheService],
  exports: [RagCacheService],
})
export class CacheModule {}
