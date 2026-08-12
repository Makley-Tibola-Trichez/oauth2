import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  AllExceptionsFilter,
  DomainExceptionFilter,
  InfraExceptionFilter,
  OauthExceptionFilter,
} from './common/filters';
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

  // O Nest INVERTE a lista de filtros internamente antes de escolher o
  // primeiro que casa (RouterExceptionFilters.create faz filters.reverse()),
  // então o catch-all precisa vir PRIMEIRO aqui para acabar avaliado por
  // último — na ordem "natural" de leitura, os específicos perderiam sempre
  // para o @Catch() sem argumentos do AllExceptionsFilter.
  app.useGlobalFilters(
    app.get(AllExceptionsFilter),
    app.get(InfraExceptionFilter),
    new DomainExceptionFilter(),
    new OauthExceptionFilter(),
  );

  const config = app.get(AppConfigService);
  await app.listen(config.port);
}

void bootstrap();
