import { VaultService } from './vault.interfaces';

/** Cofre em memória, usado nos testes para não depender do Vault real. */
export class VaultFakeService extends VaultService {
  private readonly segredos = new Map<string, Record<string, unknown>>();

  disponivel = true;

  constructor(segredosIniciais?: Record<string, Record<string, unknown>>) {
    super();
    for (const [caminho, dados] of Object.entries(segredosIniciais ?? {})) {
      this.segredos.set(this.normalizar(caminho), structuredClone(dados));
    }
  }

  private normalizar(caminho: string): string {
    return caminho.replace(/^\/+|\/+$/g, '');
  }

  private garantirDisponivel(): void {
    if (!this.disponivel) {
      throw new Error('Vault fake configurado como indisponível');
    }
  }

  async lerSegredo(caminho: string): Promise<Record<string, unknown> | null> {
    this.garantirDisponivel();
    const valor = this.segredos.get(this.normalizar(caminho));
    return valor ? structuredClone(valor) : null;
  }

  async gravarSegredo(caminho: string, dados: Record<string, unknown>): Promise<void> {
    this.garantirDisponivel();
    this.segredos.set(this.normalizar(caminho), structuredClone(dados));
  }

  async removerSegredo(caminho: string): Promise<void> {
    this.garantirDisponivel();
    this.segredos.delete(this.normalizar(caminho));
  }

  async verificarSaude(): Promise<boolean> {
    return this.disponivel;
  }

  /** Acesso direto ao conteúdo, útil nas asserções dos testes. */
  get segredosArmazenados(): ReadonlyMap<string, Record<string, unknown>> {
    return this.segredos;
  }
}
