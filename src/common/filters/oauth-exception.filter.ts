import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ErroOAuth } from '../errors';

/** Traduz erros de domínio OAuth para o formato da RFC 6749. */
@Catch(ErroOAuth)
export class OauthExceptionFilter implements ExceptionFilter {
  catch(excecao: ErroOAuth, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (excecao.statusCode === HttpStatus.UNAUTHORIZED) {
      response.setHeader('WWW-Authenticate', 'Bearer');
    }
    response.status(excecao.statusCode).json({
      error: excecao.erro,
      error_description: excecao.message,
    });
  }
}
