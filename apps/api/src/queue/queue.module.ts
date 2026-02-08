import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

function writeLog(location: string, message: string, data: any, hypothesisId: string) {
  try {
    // Find workspace root by looking for package.json or node_modules
    let workspaceRoot = process.cwd();
    let currentDir = workspaceRoot;
    let found = false;
    for (let i = 0; i < 10; i++) {
      if (fs.existsSync(path.join(currentDir, 'package.json')) && 
          fs.existsSync(path.join(currentDir, 'apps'))) {
        workspaceRoot = currentDir;
        found = true;
        break;
      }
      const parent = path.dirname(currentDir);
      if (parent === currentDir) break; // Reached filesystem root
      currentDir = parent;
    }
    if (!found) {
      // Fallback: try relative to __dirname
      workspaceRoot = path.resolve(__dirname, '../../../../..');
    }
    const logPath = path.join(workspaceRoot, '.cursor/debug.log');
    // Ensure .cursor directory exists
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logEntry = JSON.stringify({location,message,data,timestamp:Date.now(),hypothesisId,runId:'run1'}) + '\n';
    fs.appendFileSync(logPath, logEntry);
  } catch (e) {
    // Silently fail to avoid breaking the app
    console.error('[writeLog error]', e);
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        
        // #region agent log
        writeLog('queue.module.ts:12', 'Configuring Redis connection', {hasRedisUrl:!!redisUrl,redisHost:configService.get<string>('REDIS_HOST','localhost'),redisPort:configService.get<number>('REDIS_PORT',6379)}, 'B');
        // #endregion
        
        if (redisUrl) {
          // Parse Redis URL
          const url = new URL(redisUrl);
          const config = {
            connection: {
              host: url.hostname,
              port: parseInt(url.port || '6379'),
              password: url.password,
            },
          };
          // #region agent log
          writeLog('queue.module.ts:20', 'Using Redis URL configuration', {host:url.hostname,port:parseInt(url.port || '6379'),hasPassword:!!url.password}, 'B');
          // #endregion
          return config;
        }

        // Fallback to individual config
        const config = {
          connection: {
            host: configService.get<string>('REDIS_HOST', 'localhost'),
            port: configService.get<number>('REDIS_PORT', 6379),
          },
        };
        // #region agent log
        writeLog('queue.module.ts:30', 'Using fallback Redis configuration', config.connection, 'B');
        // #endregion
        return config;
      },
      inject: [ConfigService],
    }),
    // Register queues with timeout and retry configuration
    // Note: Worker settings (stalledInterval, maxStalledCount) are configured in @Processor decorators
    BullModule.registerQueue(
      {
        name: 'parsing',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
      {
        name: 'ocr',
        defaultJobOptions: {
          attempts: 2, // OCR is expensive, fewer retries
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
      {
        name: 'chunking',
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
      {
        name: 'embeddings',
        defaultJobOptions: {
          attempts: 2, // Embeddings are expensive
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}

