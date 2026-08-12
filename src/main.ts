import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { JSON_LOGGER } from './common/logging';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  // bufferLogs: adia a escolha do logger até o DI estar pronto, para que o
  // nível configurado em LOG_LEVEL valha desde a primeira linha.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(JSON_LOGGER));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = app.get(AppConfigService);
  await app.listen(config.port);
}

void bootstrap();
