/**
 * Handler global de erros. Erros de domínio (`ErroOAuth`, `ErroDeNegocio`,
 * `ChaveDeAssinaturaIndisponivelError`, `VaultError`) viram a resposta HTTP
 * correspondente; qualquer outra coisa vira `500` genérico, sempre logado.
 */

import { Elysia } from 'elysia';
import { VaultError } from '../vault/client';
import {
  AutenticacaoAdminIndisponivelError,
  ChaveDeAssinaturaIndisponivelError,
  CredencialAdminInvalidaError,
  ErroDeNegocio,
  ErroOAuth,
} from './errors';
import { logger } from './logging';

export const errorHandlerPlugin = new Elysia({ name: 'error-handler' }).onError(
  { as: 'global' },
  ({ error, code, set }) => {
    if (error instanceof ErroOAuth) {
      set.status = error.statusCode;
      if (error.statusCode === 401) {
        set.headers['WWW-Authenticate'] = 'Bearer';
      }
      return { error: error.erro, error_description: error.message };
    }

    if (error instanceof CredencialAdminInvalidaError) {
      set.status = 401;
      set.headers['WWW-Authenticate'] = 'Bearer';
      return { detail: error.message };
    }

    if (error instanceof AutenticacaoAdminIndisponivelError) {
      set.status = 503;
      logger.error(error.message, 'error-handler', { tipo: error.constructor.name });
      return { detail: error.message };
    }

    if (error instanceof ErroDeNegocio) {
      set.status = error.statusCode;
      return { detail: error.message };
    }

    if (error instanceof ChaveDeAssinaturaIndisponivelError || error instanceof VaultError) {
      set.status = 503;
      logger.error(error.message, 'error-handler', { tipo: error.constructor.name });
      return {
        detail:
          error instanceof VaultError
            ? 'Cofre de segredos indisponível'
            : 'Serviço de assinatura indisponível',
      };
    }

    if (code === 'VALIDATION') {
      set.status = 422;
      return { statusCode: 422, message: error.message };
    }

    if (code === 'NOT_FOUND') {
      set.status = 404;
      return { statusCode: 404, message: 'Rota não encontrada' };
    }

    set.status = 500;
    logger.error(error instanceof Error ? error.message : 'Erro desconhecido', 'error-handler', {
      codigo: code,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return { statusCode: 500, message: 'Internal server error' };
  },
);
