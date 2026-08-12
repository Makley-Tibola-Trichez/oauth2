import { describe, expect, it } from 'vitest';
import { CredencialAdminInvalidaError } from './admin-auth.errors';
import { ORIGEM_ESTATICA } from './autenticador.interface';
import { AutenticadorTokenEstaticoService } from './autenticador-token-estatico.service';

const TOKEN = 'token-administrativo-de-teste';

describe('AutenticadorTokenEstaticoService', () => {
  it('aceita o token correto', async () => {
    const identidade = await new AutenticadorTokenEstaticoService(TOKEN).autenticar(TOKEN);

    expect(identidade.origem).toBe(ORIGEM_ESTATICA);
    expect(identidade.identificador).toBe('administrador-local');
  });

  it.each([undefined, null, '', 'token-errado', `${TOKEN}x`, TOKEN.toUpperCase()])(
    'recusa credencial inválida %s',
    async (credencial) => {
      const autenticador = new AutenticadorTokenEstaticoService(TOKEN);
      await expect(autenticador.autenticar(credencial)).rejects.toThrow(
        CredencialAdminInvalidaError,
      );
    },
  );

  it('exige token configurado', () => {
    expect(() => new AutenticadorTokenEstaticoService('')).toThrow('não configurado');
  });
});
