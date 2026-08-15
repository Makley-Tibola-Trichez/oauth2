import { describe, expect, it } from 'bun:test';
import { gerarHash, verificarHash } from './hashing';
import { gerarClientId, gerarClientSecret } from './secret-generator';

describe('hashing', () => {
  it('o hash não contém o secret', async () => {
    const secret = gerarClientSecret();
    const hash = await gerarHash(secret);

    expect(hash).not.toContain(secret);
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('verifica o secret correto', async () => {
    const secret = gerarClientSecret();
    expect(await verificarHash(secret, await gerarHash(secret))).toBe(true);
  });

  for (const candidato of ['secret-errado', '', ' ', 'SECRET']) {
    it(`recusa o secret incorreto "${candidato}"`, async () => {
      const hash = await gerarHash('secret-verdadeiro');
      expect(await verificarHash(candidato, hash)).toBe(false);
    });
  }

  it('hash inválido não lança exceção', async () => {
    expect(await verificarHash('qualquer', 'isto-nao-e-um-hash')).toBe(false);
    expect(await verificarHash('qualquer', '')).toBe(false);
  });

  it('o mesmo secret gera hashes diferentes (salt aleatório)', async () => {
    const secret = gerarClientSecret();
    expect(await gerarHash(secret)).not.toBe(await gerarHash(secret));
  });
});

describe('secret-generator', () => {
  it('gera secrets únicos e longos', () => {
    const secrets = new Set(Array.from({ length: 200 }, () => gerarClientSecret()));

    expect(secrets.size).toBe(200);
    for (const s of secrets) {
      expect(s.length).toBeGreaterThanOrEqual(60);
    }
  });

  it('client_id gerado usa o prefixo informado', () => {
    const clientId = gerarClientId('servico');

    expect(clientId.startsWith('servico_')).toBe(true);
    expect(clientId).not.toBe(gerarClientId('servico'));
  });
});
