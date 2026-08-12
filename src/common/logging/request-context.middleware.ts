import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { obterRequestId, runWithRequestContext } from './request-context';

export const CABECALHO_REQUEST_ID = 'x-request-id';

/** Propaga (ou gera) o `X-Request-ID` e injeta no contexto assíncrono da requisição. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const recebido = req.header(CABECALHO_REQUEST_ID);
    runWithRequestContext(recebido, () => {
      res.setHeader('X-Request-ID', obterRequestId() ?? '');
      next();
    });
  }
}
