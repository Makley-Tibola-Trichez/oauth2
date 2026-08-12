import { describe, expect, it } from 'vitest';
import { VaultFakeService } from './vault-fake.service';

describe('VaultFakeService', () => {
  it('lê e escreve segredos', async () => {
    const vault = new VaultFakeService();

    expect(await vault.lerSegredo('rpa/x')).toBeNull();
    expect(await vault.existe('rpa/x')).toBe(false);

    await vault.gravarSegredo('rpa/x', { credenciais: { usuario: 'u' } });

    expect(await vault.existe('rpa/x')).toBe(true);
    expect(await vault.lerSegredo('rpa/x')).toEqual({ credenciais: { usuario: 'u' } });
  });

  it('normaliza barras nas pontas do caminho', async () => {
    const vault = new VaultFakeService();

    await vault.gravarSegredo('/rpa/x/', { a: 1 });

    expect(await vault.lerSegredo('rpa/x')).toEqual({ a: 1 });
  });

  it('remove segredo de forma idempotente', async () => {
    const vault = new VaultFakeService({ 'rpa/x': { a: 1 } });

    await vault.removerSegredo('rpa/x');
    await vault.removerSegredo('rpa/x');

    expect(await vault.existe('rpa/x')).toBe(false);
  });

  it('aceita segredos iniciais e não compartilha referência com o construtor', async () => {
    const dados = { credenciais: { usuario: 'u' } };
    const vault = new VaultFakeService({ 'rpa/x': dados });

    dados.credenciais.usuario = 'alterado-fora';

    expect(await vault.lerSegredo('rpa/x')).toEqual({ credenciais: { usuario: 'u' } });
  });

  it('não deixa alterar o segredo lido afetar o armazenado', async () => {
    const vault = new VaultFakeService({ 'rpa/x': { credenciais: { usuario: 'u' } } });

    const lido = (await vault.lerSegredo('rpa/x')) as { credenciais: { usuario: string } };
    lido.credenciais.usuario = 'alterado-depois';

    expect(await vault.lerSegredo('rpa/x')).toEqual({ credenciais: { usuario: 'u' } });
  });

  it('lança quando configurado como indisponível', async () => {
    const vault = new VaultFakeService();
    vault.disponivel = false;

    await expect(vault.lerSegredo('rpa/x')).rejects.toThrow('indisponível');
    expect(await vault.verificarSaude()).toBe(false);
  });
});
