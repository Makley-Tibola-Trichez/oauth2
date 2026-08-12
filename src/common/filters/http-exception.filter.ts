import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { JSON_LOGGER } from '../logging';
import type { JsonLoggerService } from '../logging/json-logger.service';

/**
 * Filtro global de exceções. Erros de domínio (`ErroOAuth`, `ErroDeNegocio`)
 * ganham seus próprios filtros, registrados junto aos módulos que os
 * definem — este cobre o que sobra: `HttpException` do próprio Nest e
 * qualquer exceção não tratada, sempre logada em JSON, nunca com stack de
 * segredo (o `JsonLoggerService` redige os campos estruturados).
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(JSON_LOGGER) private readonly logger: JsonLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const corpo = exception.getResponse();
      if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        this.logger.error('Erro não tratado na requisição', undefined, 'ExceptionFilter');
      }
      response.status(status).json(typeof corpo === 'string' ? { message: corpo } : corpo);
      return;
    }

    this.logger.error(
      exception instanceof Error ? exception.message : 'Erro desconhecido',
      exception instanceof Error ? exception.stack : undefined,
      'ExceptionFilter',
    );
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' });
  }
}
