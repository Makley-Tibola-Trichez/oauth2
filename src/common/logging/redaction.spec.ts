import { describe, expect, it } from 'vitest';
import { campoESensivel, redigir, redigirCampos, VALOR_REDIGIDO } from './redaction';

describe('redaction', () => {
  it.each([
    'clientSecret',
    'client_secret',
    'clientSecretHash',
    'accessToken',
    'refreshToken',
    'vaultToken',
    'privatePem',
    'senha',
    'password',
    'authorization',
    'apiKey',
    'credenciais',
  ])('redige o campo sensível "%s"', (campo) => {
    const saida = redigirCampos({ [campo]: 'valor-secreto' });
    expect(saida[campo]).toBe(VALOR_REDIGIDO);
    expect(JSON.stringify(saida)).not.toContain('valor-secreto');
  });

  it('redige campos aninhados dentro de objetos e arrays', () => {
    const saida = redigirCampos({
      contexto: {
        clientId: 'svc_x',
        dados: [{ clientSecret: 'abc' }, { ok: 'visivel' }],
      },
    });

    const contexto = saida.contexto as Record<string, unknown>;
    const dados = contexto.dados as Record<string, unknown>[];
    expect(dados[0].clientSecret).toBe(VALOR_REDIGIDO);
    expect(dados[1].ok).toBe('visivel');
    expect(contexto.clientId).toBe('svc_x');
  });

  it('mantém campos de negócio intactos', () => {
    const saida = redigirCampos({
      evento: 'autenticacao_sucesso',
      clientId: 'app_rpa',
      rpaId: 'rpa_custeio',
    });

    expect(saida).toEqual({
      evento: 'autenticacao_sucesso',
      clientId: 'app_rpa',
      rpaId: 'rpa_custeio',
    });
  });

  it('não redige termos OAuth inofensivos', () => {
    const saida = redigirCampos({ tokenType: 'Bearer', grantType: 'client_credentials' });

    expect(saida.tokenType).toBe('Bearer');
    expect(saida.grantType).toBe('client_credentials');
  });

  it.each([
    ['clientSecret', true],
    ['CLIENT_SECRET', true],
    ['secretRotacionadoEm', true],
    ['tokenType', false],
    ['clientId', false],
    ['rpaId', false],
    ['jti', false],
  ] as const)('classifica "%s" como sensível=%s', (campo, sensivel) => {
    expect(campoESensivel(campo)).toBe(sensivel);
  });

  it('preserva valores primitivos e datas sem alteração', () => {
    const data = new Date('2026-01-01T00:00:00Z');
    expect(redigir(42)).toBe(42);
    expect(redigir(null)).toBeNull();
    expect(redigir(data)).toBe(data);
  });
});
