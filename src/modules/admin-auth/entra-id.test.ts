import { describe, expect, it } from 'bun:test';
import { ORIGEM_ENTRA_ID } from './admin-auth.types';
import { AutenticadorEntraId } from './entra-id';

describe('AutenticadorEntraId', () => {
  it('expõe issuer e URL do JWKS a partir do tenant', () => {
    const autenticador = new AutenticadorEntraId('tenant-123', 'client-456');

    expect(autenticador.origem).toBe(ORIGEM_ENTRA_ID);
    expect(autenticador.urlJwks).toContain('tenant-123');
    expect(autenticador.issuerEsperado).toBe('https://login.microsoftonline.com/tenant-123/v2.0');
  });

  it('falha de forma explícita enquanto não homologado', async () => {
    const autenticador = new AutenticadorEntraId('t', 'c');

    await expect(autenticador.autenticar('qualquer-token')).rejects.toThrow(
      /ainda não implementada/,
    );
  });
});
