import { describe, expect, it } from 'bun:test';
import { FakeVaultClient } from '../../vault';
import { verificarSaude } from './health.service';

const dbOk = { $queryRaw: async () => [{ '?column?': 1 }] } as never;
const dbFalha = {
  $queryRaw: async () => {
    throw new Error('conexão recusada');
  },
} as never;

describe('verificarSaude', () => {
  it('retorna ok quando o banco e o Vault respondem', async () => {
    const vault = new FakeVaultClient();

    const resposta = await verificarSaude(dbOk, vault);

    expect(resposta.status).toBe('ok');
    expect(resposta.componentes).toEqual({ bancoDeDados: 'ok', vault: 'ok' });
    expect(resposta.aplicacao).toBe('OAuth2 Auth Service');
    expect(resposta.ambiente).toBe('test');
    expect(resposta.versao).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('retorna degradado quando o banco de dados falha', async () => {
    const vault = new FakeVaultClient();

    const resposta = await verificarSaude(dbFalha, vault);

    expect(resposta.status).toBe('degradado');
    expect(resposta.componentes.bancoDeDados).toBe('indisponivel');
    expect(resposta.componentes.vault).toBe('ok');
  });

  it('retorna degradado quando o Vault falha', async () => {
    const vault = new FakeVaultClient();
    vault.disponivel = false;

    const resposta = await verificarSaude(dbOk, vault);

    expect(resposta.status).toBe('degradado');
    expect(resposta.componentes.vault).toBe('indisponivel');
  });

  it('não deixa uma exceção do Vault derrubar o healthcheck', async () => {
    const vaultQuebrado = {
      verificarSaude: async () => {
        throw new Error('timeout');
      },
    } as never;

    const resposta = await verificarSaude(dbOk, vaultQuebrado);

    expect(resposta.componentes.vault).toBe('indisponivel');
  });
});
