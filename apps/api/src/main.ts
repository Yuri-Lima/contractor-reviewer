import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

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
