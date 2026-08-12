/**
 * Contrato do cofre de segredos.
 *
 * A aplicação nunca fala com o HashiCorp Vault diretamente: depende desta
 * abstração, o que permite trocar o backend (Azure Key Vault, AWS Secrets
 * Manager) e usar um fake em memória nos testes. A própria classe serve de
 * token de injeção — `VaultHttpService` é o provider padrão, trocado por
 * `VaultFakeService` nos testes via `overrideProvider(VaultService)`.
 *
 * Todos os caminhos são **relativos** ao prefixo da aplicação — por exemplo
 * `jwt/keys/{kid}` ou `rpa/{rpaId}`.
 */
export abstract class VaultService {
  abstract lerSegredo(caminho: string): Promise<Record<string, unknown> | null>;

  abstract gravarSegredo(caminho: string, dados: Record<string, unknown>): Promise<void>;

  /** Remove o segredo (e todas as suas versões). Idempotente. */
  abstract removerSegredo(caminho: string): Promise<void>;

  /** Indica se o cofre está acessível e destravado. */
  abstract verificarSaude(): Promise<boolean>;

  /** Libera recursos (conexões HTTP, por exemplo). Sem efeito por padrão. */
  async fechar(): Promise<void> {
    return undefined;
  }

  /** Presença de um segredo — é o sinal de autorização de um `rpaId`. */
  async existe(caminho: string): Promise<boolean> {
    return (await this.lerSegredo(caminho)) !== null;
  }
}
