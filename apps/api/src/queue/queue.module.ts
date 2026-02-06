import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        if (redisUrl) {
          // Parse Redis URL
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port || '6379'),
              password: url.password,
            },
          };
        }

        // Fallback to individual config
        return {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
        };
      },
      inject: [ConfigService],
    }),
    // Register queues
    BullModule.registerQueue(
      { name: 'ocr' },
      { name: 'parsing' },
      { name: 'chunking' },
      { name: 'embeddings' },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

