/**
 * Plugin Elysia: gera/propaga o `X-Request-ID`, injeta no contexto
 * assíncrono da requisição (para os logs) e registra uma linha por
 * requisição concluída.
 */

import { Elysia } from 'elysia';
import { logger } from './logger';
import { definirRequestId, obterRequestId } from './request-context';

export const CABECALHO_REQUEST_ID = 'x-request-id';

export const requestLogPlugin = new Elysia({ name: 'request-log' })
  .onRequest(({ request }) => {
    definirRequestId(request.headers.get(CABECALHO_REQUEST_ID));
  })
  .derive({ as: 'global' }, () => {
    const inicio = performance.now();
    return { inicioDaRequisicao: inicio };
  })
  .onAfterHandle({ as: 'global' }, ({ request, set, inicioDaRequisicao }) => {
    const duracaoMs = Math.round((performance.now() - inicioDaRequisicao) * 100) / 100;
    const url = new URL(request.url);
    logger.info('Requisição concluída', 'http', {
      metodo: request.method,
      rota: url.pathname,
      status: set.status ?? 200,
      duracaoMs,
    });
    set.headers[CABECALHO_REQUEST_ID] = obterRequestId() ?? definirRequestId();
  })
  .onError({ as: 'global' }, ({ request, error, code }) => {
    const url = new URL(request.url);
    logger.error('Erro não tratado na requisição', 'http', {
      metodo: request.method,
      rota: url.pathname,
      codigo: code,
      motivo: error instanceof Error ? error.message : String(error),
    });
  });
