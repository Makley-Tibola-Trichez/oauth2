import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ErroDeNegocio } from '../errors';

/** Traduz erros de negócio administrativos para `{"detail": ...}`. */
@Catch(ErroDeNegocio)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(excecao: ErroDeNegocio, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.status(excecao.statusCode).json({ detail: excecao.message });
  }
}
