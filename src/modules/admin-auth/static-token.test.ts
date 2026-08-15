import { describe, expect, it } from 'bun:test';
import { CredencialAdminInvalidaError } from '../../shared/errors';
import { ORIGEM_ESTATICA } from './admin-auth.types';
import { AutenticadorTokenEstatico } from './static-token';

const TOKEN = 'token-administrativo-de-teste';

describe('AutenticadorTokenEstatico', () => {
  it('aceita o token correto', async () => {
    const identidade = await new AutenticadorTokenEstatico(TOKEN).autenticar(TOKEN);

    expect(identidade.origem).toBe(ORIGEM_ESTATICA);
    expect(identidade.identificador).toBe('administrador-local');
  });

  for (const credencial of [
    undefined,
    null,
    '',
    'token-errado',
    `${TOKEN}x`,
    TOKEN.toUpperCase(),
  ]) {
    it(`recusa credencial inválida ${JSON.stringify(credencial)}`, async () => {
      const autenticador = new AutenticadorTokenEstatico(TOKEN);
      await expect(autenticador.autenticar(credencial)).rejects.toThrow(
        CredencialAdminInvalidaError,
      );
    });
  }

  it('exige token configurado', () => {
    expect(() => new AutenticadorTokenEstatico('')).toThrow('não configurado');
  });

  it('aceita um identificador customizado', async () => {
    const identidade = await new AutenticadorTokenEstatico(TOKEN, 'ci-pipeline').autenticar(TOKEN);
    expect(identidade.identificador).toBe('ci-pipeline');
  });
});
