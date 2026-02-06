import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { WorkersModule } from './workers/workers.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Import workers module to register processors
  await app.select(WorkersModule).init();

  console.log('Workers started. Processing jobs...');
  
  // Keep the process alive
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
