import { describe, expect, it } from 'vitest';
import { HashingService } from './hashing.service';
import { SecretGeneratorService } from './secret-generator.service';

describe('HashingService', () => {
  const hasher = new HashingService();
  const gerador = new SecretGeneratorService();

  it('o hash não contém o secret', async () => {
    const secret = gerador.gerarClientSecret();
    const hash = await hasher.gerarHash(secret);

    expect(hash).not.toContain(secret);
    expect(hash.startsWith('$argon2')).toBe(true);
  });

  it('verifica o secret correto', async () => {
    const secret = gerador.gerarClientSecret();
    expect(await hasher.verificar(secret, await hasher.gerarHash(secret))).toBe(true);
  });

  it.each(['secret-errado', '', ' ', 'SECRET'])(
    'recusa o secret incorreto "%s"',
    async (candidato) => {
      const hash = await hasher.gerarHash('secret-verdadeiro');
      expect(await hasher.verificar(candidato, hash)).toBe(false);
    },
  );

  it('hash inválido não lança exceção', async () => {
    expect(await hasher.verificar('qualquer', 'isto-nao-e-um-hash')).toBe(false);
    expect(await hasher.verificar('qualquer', '')).toBe(false);
  });

  it('o mesmo secret gera hashes diferentes (salt aleatório)', async () => {
    const secret = gerador.gerarClientSecret();
    expect(await hasher.gerarHash(secret)).not.toBe(await hasher.gerarHash(secret));
  });
});

describe('SecretGeneratorService', () => {
  const gerador = new SecretGeneratorService();

  it('gera secrets únicos e longos', () => {
    const secrets = new Set(Array.from({ length: 200 }, () => gerador.gerarClientSecret()));

    expect(secrets.size).toBe(200);
    for (const s of secrets) {
      expect(s.length).toBeGreaterThanOrEqual(60);
    }
  });

  it('client_id gerado usa o prefixo informado', () => {
    const clientId = gerador.gerarClientId('servico');

    expect(clientId.startsWith('servico_')).toBe(true);
    expect(clientId).not.toBe(gerador.gerarClientId('servico'));
  });
});
