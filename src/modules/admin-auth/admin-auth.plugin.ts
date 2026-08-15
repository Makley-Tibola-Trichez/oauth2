/**
 * Guard de rotas administrativas.
 *
 * Uso: `.use(adminAuthPlugin)` em qualquer grupo de rotas que exija
 * credencial de admin — `{ as: 'scoped' }` propaga o `.derive()` só para
 * quem usa o plugin diretamente (o router que fez o `.use()`), sem vazar a
 * checagem para o app inteiro. Rotas públicas (`/health`, `/.well-known`,
 * `/oauth/*`) nunca veem este plugin.
 */

import { Elysia } from 'elysia';
import {
  AutenticacaoAdminIndisponivelError,
  CredencialAdminInvalidaError,
} from '../../shared/errors';
import { EVENTOS_AUDITORIA, registrarFalhaAuditoria } from '../../shared/logging';
import type { AutenticadorAdmin } from './admin-auth.types';
import { autenticadorAdmin } from './factory';

function extrairTokenBearer(cabecalho: string | undefined): string | undefined {
  if (!cabecalho?.startsWith('Bearer ')) {
    return undefined;
  }
  return cabecalho.slice('Bearer '.length).trim();
}

/** Fábrica do plugin — recebe o autenticador por parâmetro para testes. */
export function criarAdminAuthPlugin(autenticador: AutenticadorAdmin = autenticadorAdmin) {
  return new Elysia({ name: 'admin-auth' }).derive({ as: 'scoped' }, async ({ headers }) => {
    const credencial = extrairTokenBearer(headers.authorization);

    try {
      const adminIdentity = await autenticador.autenticar(credencial);
      return { adminIdentity };
    } catch (erro) {
      if (erro instanceof CredencialAdminInvalidaError) {
        registrarFalhaAuditoria(
          EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
          'Credencial administrativa recusada',
          { origem: autenticador.origem },
        );
        throw erro;
      }
      throw new AutenticacaoAdminIndisponivelError(
        erro instanceof Error ? erro.message : 'Autenticação administrativa indisponível',
      );
    }
  });
}

/** Instância pronta para composição direta nos routers administrativos. */
export const adminAuthPlugin = criarAdminAuthPlugin();
