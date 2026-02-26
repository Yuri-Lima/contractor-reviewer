import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from './common/common.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { StorageModule } from './storage/storage.module';
import { QueueModule } from './queue/queue.module';
import { DocumentsModule } from './documents/documents.module';
import { WorkersModule } from './workers/workers.module';
import { RagModule } from './rag/rag.module';
import { PrivacyModule } from './privacy/privacy.module';
import { AuditModule } from './audit/audit.module';
import { RetentionModule } from './retention/retention.module';
import { PromptsModule } from './prompts/prompts.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { ImageManagerModule } from './image-manager/image-manager.module';
import { typeOrmModuleOptions } from './typeorm.options';

// Conditionally import AppController - only for API server, not worker
// Workers use ApplicationContext which doesn't need controllers
const isWorker = 
  typeof require !== 'undefined' && 
  require.main &&
  (require.main.filename?.includes('worker') || 
   process.argv[1]?.includes('worker') ||
   process.argv[1]?.includes('dist/worker'));

let AppController: any = null;
if (!isWorker) {
  try {
    // Use require with try-catch to handle missing file gracefully
    const appControllerModule = require('./app.controller');
    AppController = appControllerModule?.AppController;
  } catch (err) {
    // AppController not available (e.g., in worker context), continue without it
    AppController = null;
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    CommonModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => typeOrmModuleOptions(),
    }),
    // Only enable scheduled jobs in API server, not in worker
    ...(isWorker ? [] : [ScheduleModule.forRoot()]),
    AuthModule,
    WorkspaceModule,
    StorageModule,
    QueueModule,
    RagModule,
    DocumentsModule,
    WorkersModule,
    PrivacyModule,
    AuditModule,
    RetentionModule,
    PromptsModule,
    OnboardingModule,
    ImageManagerModule,
  ],
  controllers: AppController ? [AppController] : [],
})
export class AppModule {}
