import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { REDIS_CLIENT } from './queue/redis.provider';
import { WsPortIoAdapter } from './websocket/ws-port.adapter';

const isWorker =
  typeof require !== 'undefined' &&
  require.main &&
  (require.main.filename?.includes('worker') ||
    process.argv[1]?.includes('worker') ||
    process.argv[1]?.includes('dist/worker'));

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');

  // Enable CORS for frontend (allow both 4200 and 4400 for dev)
  const frontendUrl = process.env['FRONTEND_URL'];
  const allowedOrigins = frontendUrl
    ? frontendUrl.split(',').map((o) => o.trim())
    : ['http://localhost:4200', 'http://localhost:4400'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // WebSocket on port 3200 (API only, not worker)
  if (!isWorker) {
    const wsPort = parseInt(process.env['WS_PORT'] || '3200', 10);
    const redis = app.get(REDIS_CLIENT);
    app.useWebSocketAdapter(
      new WsPortIoAdapter(app, {
        wsPort,
        redis,
        corsOrigins: allowedOrigins,
      }),
    );
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // Never log contract content, chunks, or user messages in plaintext
  console.log(`API listening on http://localhost:${port}/api`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
