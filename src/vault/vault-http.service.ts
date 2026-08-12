import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import type { AxiosError, AxiosResponse } from 'axios';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AppConfigService } from '../config/app-config.service';
import { VaultIndisponivelError, VaultPermissaoError } from './vault.errors';
import { VaultService } from './vault.interfaces';

/**
 * Implementação do `VaultService` sobre a API KV v2 do HashiCorp Vault.
 *
 * Usa `HttpService` (axios via `@nestjs/axios`) em vez do SDK oficial: os
 * pacotes Node disponíveis para o Vault são pouco mantidos ou trazem
 * dependências desnecessárias, e a superfície usada aqui é pequena — ler,
 * gravar, remover e healthcheck.
 */
@Injectable()
export class VaultHttpService extends VaultService {
  private readonly logger = new Logger(VaultHttpService.name);
  private readonly mount: string;
  private readonly prefixo: string;
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(
    private readonly http: HttpService,
    config: AppConfigService,
  ) {
    super();
    this.baseUrl = config.vaultAddr.replace(/\/+$/, '');
    this.token = config.vaultToken;
    this.mount = config.vaultKvMount.replace(/^\/+|\/+$/g, '');
    this.prefixo = config.vaultBasePath;
  }

  private caminhoCompleto(caminho: string): string {
    return `${this.prefixo}/${caminho.replace(/^\/+|\/+$/g, '')}`;
  }

  private urlDados(caminho: string): string {
    return `${this.baseUrl}/v1/${this.mount}/data/${this.caminhoCompleto(caminho)}`;
  }

  private urlMetadados(caminho: string): string {
    return `${this.baseUrl}/v1/${this.mount}/metadata/${this.caminhoCompleto(caminho)}`;
  }

  private get cabecalhos(): Record<string, string> {
    return { 'X-Vault-Token': this.token };
  }

  async lerSegredo(caminho: string): Promise<Record<string, unknown> | null> {
    const resposta = await this.requisitar('get', this.urlDados(caminho));
    if (resposta === null) {
      return null;
    }
    return (resposta.data?.data?.data ?? null) as Record<string, unknown> | null;
  }

  async gravarSegredo(caminho: string, dados: Record<string, unknown>): Promise<void> {
    await this.requisitar('post', this.urlDados(caminho), { data: dados }, false);
  }

  async removerSegredo(caminho: string): Promise<void> {
    await this.requisitar('delete', this.urlMetadados(caminho));
  }

  async verificarSaude(): Promise<boolean> {
    const resposta = await firstValueFrom(
      this.http
        .get(`${this.baseUrl}/v1/sys/health`, { headers: this.cabecalhos })
        .pipe(catchError(() => of(null))),
    );
    // 200 = destravado e ativo; 429 = standby, ainda utilizável para leitura.
    return resposta !== null && (resposta.status === 200 || resposta.status === 429);
  }

  private async requisitar(
    metodo: 'get' | 'post' | 'delete',
    url: string,
    corpo?: unknown,
    aceitar404 = true,
  ): Promise<AxiosResponse | null> {
    let resposta: AxiosResponse;
    try {
      resposta = await firstValueFrom(
        this.http.request({
          method: metodo,
          url,
          data: corpo,
          headers: this.cabecalhos,
          validateStatus: () => true,
        }),
      );
    } catch (erro) {
      this.logger.warn('Falha de comunicação com o Vault', (erro as AxiosError)?.message);
      throw new VaultIndisponivelError(`Falha de comunicação com o Vault: ${erro}`);
    }

    if (resposta.status === 404 && aceitar404) {
      return null;
    }
    if (resposta.status === 401 || resposta.status === 403) {
      throw new VaultPermissaoError('Token do Vault sem permissão sobre o caminho solicitado');
    }
    if (resposta.status >= 400) {
      throw new VaultIndisponivelError(
        `Vault respondeu ${resposta.status} para ${metodo.toUpperCase()} ${url}`,
      );
    }
    return resposta;
  }
}
