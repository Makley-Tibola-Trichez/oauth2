import type { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { AppConfigService } from '../config/app-config.service';
import { VaultIndisponivelError, VaultPermissaoError } from './vault.errors';
import { VaultHttpService } from './vault-http.service';

function respostaAxios(status: number, data: unknown = {}): AxiosResponse {
  return { status, data, statusText: '', headers: {}, config: {} as never };
}

function criarServico(http: HttpService) {
  const config = mock<AppConfigService>({
    vaultAddr: 'http://localhost:8200',
    vaultToken: 'dev-root-token',
    vaultKvMount: 'secret',
    vaultBasePath: 'oauth',
  });
  return new VaultHttpService(http, config);
}

describe('VaultHttpService', () => {
  it('lê um segredo existente extraindo data.data', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(of(respostaAxios(200, { data: { data: { usuario: 'u' } } })));

    const resultado = await criarServico(http).lerSegredo('rpa/x');

    expect(resultado).toEqual({ usuario: 'u' });
    const chamada = http.request.mock.calls[0][0];
    expect(chamada.url).toBe('http://localhost:8200/v1/secret/data/oauth/rpa/x');
    expect(chamada.headers).toEqual({ 'X-Vault-Token': 'dev-root-token' });
  });

  it('retorna null quando o segredo não existe (404)', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(of(respostaAxios(404)));

    expect(await criarServico(http).lerSegredo('rpa/inexistente')).toBeNull();
  });

  it('lança VaultPermissaoError em 401/403', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(of(respostaAxios(403)));

    await expect(criarServico(http).lerSegredo('rpa/x')).rejects.toThrow(VaultPermissaoError);
  });

  it('lança VaultIndisponivelError para outros erros HTTP', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(of(respostaAxios(500)));

    await expect(criarServico(http).lerSegredo('rpa/x')).rejects.toThrow(VaultIndisponivelError);
  });

  it('lança VaultIndisponivelError em falha de rede', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));

    await expect(criarServico(http).lerSegredo('rpa/x')).rejects.toThrow(VaultIndisponivelError);
  });

  it('gravarSegredo envia os dados envelopados em {data}', async () => {
    const http = mock<HttpService>();
    http.request.mockReturnValue(of(respostaAxios(200)));

    await criarServico(http).gravarSegredo('rpa/x', { credenciais: { usuario: 'u' } });

    const chamada = http.request.mock.calls[0][0];
    expect(chamada.method).toBe('post');
    expect(chamada.data).toEqual({ data: { credenciais: { usuario: 'u' } } });
  });

  it('verificarSaude aceita 200 e 429, recusa o resto', async () => {
    const http = mock<HttpService>();

    http.request.mockReturnValue(of(respostaAxios(200)));
    http.get.mockReturnValue(of(respostaAxios(200)));
    expect(await criarServico(http).verificarSaude()).toBe(true);

    http.get.mockReturnValue(of(respostaAxios(429)));
    expect(await criarServico(http).verificarSaude()).toBe(true);

    http.get.mockReturnValue(of(respostaAxios(500)));
    expect(await criarServico(http).verificarSaude()).toBe(false);

    http.get.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    expect(await criarServico(http).verificarSaude()).toBe(false);
  });
});
