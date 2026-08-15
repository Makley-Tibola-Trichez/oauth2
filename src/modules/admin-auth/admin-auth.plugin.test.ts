import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { errorHandlerPlugin } from '../../shared/error-handler.plugin';
import { CredencialAdminInvalidaError } from '../../shared/errors';
import { criarAdminAuthPlugin } from './admin-auth.plugin';
import type { AutenticadorAdmin, IdentidadeAdmin } from './admin-auth.types';

const IDENTIDADE: IdentidadeAdmin = { identificador: 'admin-x', origem: 'static' };

function appComAutenticador(autenticador: AutenticadorAdmin) {
  return new Elysia()
    .use(errorHandlerPlugin)
    .use(criarAdminAuthPlugin(autenticador))
    .get('/protegida', ({ adminIdentity }) => adminIdentity);
}

describe('adminAuthPlugin', () => {
  it('permite acesso e popula adminIdentity com credencial válida', async () => {
    let credencialRecebida: string | undefined | null;
    const autenticador: AutenticadorAdmin = {
      origem: 'static',
      autenticar: async (credencial) => {
        credencialRecebida = credencial;
        return IDENTIDADE;
      },
    };

    const resposta = await appComAutenticador(autenticador).handle(
      new Request('http://localhost/protegida', {
        headers: { authorization: 'Bearer token-valido' },
      }),
    );

    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual(IDENTIDADE);
    expect(credencialRecebida).toBe('token-valido');
  });

  it('rejeita com 401 quando a credencial é inválida', async () => {
    const autenticador: AutenticadorAdmin = {
      origem: 'static',
      autenticar: async () => {
        throw new CredencialAdminInvalidaError('inválida');
      },
    };

    const resposta = await appComAutenticador(autenticador).handle(
      new Request('http://localhost/protegida', { headers: { authorization: 'Bearer errado' } }),
    );

    expect(resposta.status).toBe(401);
    expect(resposta.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('rejeita com 401 quando não há cabeçalho Authorization', async () => {
    let credencialRecebida: string | undefined | null = 'não-chamado';
    const autenticador: AutenticadorAdmin = {
      origem: 'static',
      autenticar: async (credencial) => {
        credencialRecebida = credencial;
        throw new CredencialAdminInvalidaError('ausente');
      },
    };

    const resposta = await appComAutenticador(autenticador).handle(
      new Request('http://localhost/protegida'),
    );

    expect(resposta.status).toBe(401);
    expect(credencialRecebida).toBeUndefined();
  });

  it('rejeita com 503 quando o autenticador não está implementado (Entra ID)', async () => {
    const autenticador: AutenticadorAdmin = {
      origem: 'entraid',
      autenticar: async () => {
        throw new Error('ainda não implementado');
      },
    };

    const resposta = await appComAutenticador(autenticador).handle(
      new Request('http://localhost/protegida', { headers: { authorization: 'Bearer x' } }),
    );

    expect(resposta.status).toBe(503);
  });

  it('ignora cabeçalho Authorization sem o esquema Bearer', async () => {
    let credencialRecebida: string | undefined | null = 'não-chamado';
    const autenticador: AutenticadorAdmin = {
      origem: 'static',
      autenticar: async (credencial) => {
        credencialRecebida = credencial;
        throw new CredencialAdminInvalidaError();
      },
    };

    await appComAutenticador(autenticador).handle(
      new Request('http://localhost/protegida', { headers: { authorization: 'Basic xyz' } }),
    );

    expect(credencialRecebida).toBeUndefined();
  });
});
