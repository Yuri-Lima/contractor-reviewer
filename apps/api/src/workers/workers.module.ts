import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParsingProcessor } from './parsing.processor';
import { ChunkingProcessor } from './chunking.processor';
import { EmbeddingsProcessor } from './embeddings.processor';
import { OcrProcessor } from './ocr.processor';
import { DocumentJob } from '../entities/document-job.entity';
import { DocumentFile } from '../entities/document-file.entity';
import { Document } from '../entities/document.entity';
import { Chunk } from '../entities/chunk.entity';
import { WorkspaceSettings } from '../entities/workspace-settings.entity';
import { StorageModule } from '../storage/storage.module';
import { RagModule } from '../rag/rag.module';
import { QueueModule } from '../queue/queue.module';
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
    TypeOrmModule.forFeature([DocumentJob, DocumentFile, Document, Chunk, WorkspaceSettings]),
    StorageModule,
    RagModule,
    QueueModule,
  ],
  providers: [ParsingProcessor, ChunkingProcessor, EmbeddingsProcessor, OcrProcessor],
})
export class WorkersModule implements OnModuleInit {
  onModuleInit() {
    // #region agent log
    writeLog('workers.module.ts:24', 'WorkersModule initialized, processors registered', {processors:['ParsingProcessor','ChunkingProcessor','EmbeddingsProcessor','OcrProcessor']}, 'A');
    // #endregion
  }
}
