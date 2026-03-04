import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkersModule } from './workers/workers.module';
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
      workspaceRoot = path.resolve(__dirname, '../../../..');
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

async function bootstrap() {
  // #region agent log
  writeLog('worker.ts:6', 'Worker bootstrap started', {pid:process.pid,nodeEnv:process.env.NODE_ENV}, 'A');
  // #endregion
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // #region agent log
  writeLog('worker.ts:10', 'App context created, initializing WorkersModule', {}, 'A');
  // #endregion
  
  // Import workers module to register processors
  await app.select(WorkersModule).init();

  // #region agent log
  writeLog('worker.ts:15', 'WorkersModule initialized successfully', {}, 'A');
  // #endregion

  console.log('Workers started. Waiting for jobs...');
  
  // Keep the process alive
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  // #region agent log
  writeLog('worker.ts:21', 'Worker bootstrap failed', {error:err.message,stack:err.stack}, 'A');
  // #endregion
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
