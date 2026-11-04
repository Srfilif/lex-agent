import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig, CONFIG } from './shared/config';
import { HttpExceptionFilter } from './shared/presentation/http-exception.filter';
import { JsonLogger } from './shared/logging/json-logger';

async function bootstrap(): Promise<void> {
  // rawBody para verificar firmas de webhooks sobre el cuerpo crudo (Fase F).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const cfg = app.get<AppConfig>(CONFIG);
  if (cfg.nodeEnv === 'production') app.useLogger(new JsonLogger());
  // I2: CORS explícito. Dev: lista o abierto (compat local). Prod: solo lista.
  if (cfg.nodeEnv === 'production') {
    app.enableCors({ origin: cfg.corsOrigins.length ? cfg.corsOrigins : false, credentials: true });
  } else if (cfg.corsOrigins.length) {
    app.enableCors({ origin: cfg.corsOrigins, credentials: true });
  } else {
    app.enableCors(); // web en :4173 consume la API en :3000
  }
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(cfg.port);
  // eslint-disable-next-line no-console
  console.log(`lex-api escuchando en :${cfg.port} (${cfg.nodeEnv})`);
}

void bootstrap();
