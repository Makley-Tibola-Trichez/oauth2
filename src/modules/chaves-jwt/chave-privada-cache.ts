/** Cache em memória com TTL curto, para não ir ao Vault a cada token. */

export const TTL_CACHE_SEGUNDOS_PADRAO = 300;

interface ItemCache {
  valor: string;
  expiraEm: number;
}

export class ChavePrivadaCache {
  private readonly itens = new Map<string, ItemCache>();

  constructor(private readonly ttlSegundos: number = TTL_CACHE_SEGUNDOS_PADRAO) {}

  obter(kid: string): string | null {
    const item = this.itens.get(kid);
    if (!item) {
      return null;
    }
    if (Date.now() >= item.expiraEm) {
      this.itens.delete(kid);
      return null;
    }
    return item.valor;
  }

  guardar(kid: string, chavePrivadaPem: string): void {
    this.itens.set(kid, { valor: chavePrivadaPem, expiraEm: Date.now() + this.ttlSegundos * 1000 });
  }

  invalidar(kid?: string): void {
    if (kid === undefined) {
      this.itens.clear();
    } else {
      this.itens.delete(kid);
    }
  }
}
