import { describe, expect, it } from 'bun:test';
import { verificarSaude } from './health.service';

describe('verificarSaude', () => {
  it('retorna os dados da aplicação', async () => {
    const resposta = await verificarSaude();

    expect(resposta.status).toBe('ok');
    expect(resposta.aplicacao).toBe('OAuth2 Auth Service');
    expect(resposta.ambiente).toBe('test');
    expect(resposta.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
