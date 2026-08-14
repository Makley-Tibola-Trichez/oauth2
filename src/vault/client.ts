/**
 * Contrato do cofre de segredos.
 *
 * A aplicação nunca fala com o Vault diretamente: depende desta
 * abstração. **A implementação concreta (HTTP contra o HashiCorp Vault ou
 * equivalente) é fornecida à parte** — este módulo só define o contrato e
 * um fake em memória (`FakeVaultClient`) para desenvolvimento e testes.
 *
 * Todo segredo lido volta como um dicionário simples (`Record<string,
 * unknown>`); a interpretação do conteúdo é responsabilidade de quem chama.
 *
 * Todos os caminhos são **relativos** ao prefixo da aplicação — por exemplo
 * `jwt/keys/{kid}` ou `rpa/{rpaId}`.
 */
export interface VaultClient {
  /** Lê um segredo. Retorna `null` quando o caminho não existe. */
  lerSegredo(caminho: string): Promise<Record<string, unknown> | null>;

  /** Cria ou substitui o segredo no caminho informado. */
  gravarSegredo(caminho: string, dados: Record<string, unknown>): Promise<void>;

  /** Remove o segredo. Idempotente (não falha se já não existir). */
  removerSegredo(caminho: string): Promise<void>;

  /** Indica se o cofre está acessível. */
  verificarSaude(): Promise<boolean>;

  /** Presença de um segredo — é o sinal de autorização de um `rpaId`. */
  existe(caminho: string): Promise<boolean>;
}

export class VaultError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'VaultError';
  }
}

export class VaultIndisponivelError extends VaultError {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'VaultIndisponivelError';
  }
}

export class VaultPermissaoError extends VaultError {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'VaultPermissaoError';
  }
}
