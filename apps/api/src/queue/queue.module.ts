import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import IORedis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';
import { REDIS_CLIENT } from './redis.provider';
import { RedisModule } from './redis.module';

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
    RedisModule,
    BullModule.forRootAsync({
      imports: [RedisModule],
      useFactory: (redis: IORedis) => {
        writeLog('queue.module.ts:12', 'Using shared Redis connection for BullMQ', {}, 'B');
        return { connection: redis };
      },
      inject: [REDIS_CLIENT],
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
      {
        name: 'memory',
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
      {
        name: 'jurisdiction-evaluation',
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 3000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 50 },
        },
      },
    ),
  ],
  exports: [BullModule, RedisModule],
})
export class QueueModule {}

