import * as express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.use('/webhooks/clerk', express.raw({ type: 'application/json' }));
  app.use((req, res, next) => {
    console.log(`Incoming ${req.method} request to ${req.url} from ${req.headers.origin || 'unknown origin'}`);
    next();
  });
  app.enableCors({
    origin: ['https://resolvr-client.vercel.app', 'http://localhost:3001'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
  console.log(`Backend is running on port ${process.env.PORT ?? 3000}`);
  console.log(`CORS allowed for specific origins: https://resolvr-client.vercel.app, http://localhost:3001`);
}
void bootstrap();
