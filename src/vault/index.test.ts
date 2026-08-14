import { describe, expect, it } from 'bun:test';
import { caminhoChavePrivada, caminhoRpa } from './paths';

describe('caminhos do Vault', () => {
  it('monta o caminho da chave privada', () => {
    expect(caminhoChavePrivada('abc123')).toBe('jwt/keys/abc123');
  });

  it('monta o caminho das credenciais de uma RPA', () => {
    expect(caminhoRpa('rpa_custeio')).toBe('rpa/rpa_custeio');
  });
});
