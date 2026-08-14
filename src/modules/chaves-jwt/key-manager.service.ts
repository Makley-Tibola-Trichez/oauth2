/**
 * Gerenciamento do ciclo de vida das chaves de assinatura.
 *
 * Duas fontes, com papéis distintos:
 *
 * - **PostgreSQL** (`chaveJwt`, via Prisma): `kid`, chave pública e status.
 *   É daqui que sai o JWKS, então o endpoint público não depende do Vault.
 * - **Vault** (`jwt/keys/{kid}`): a chave privada, e nada além dela.
 *
 * A rotação grava no Vault **antes** de tocar no banco; a troca da chave
 * ativa acontece em uma única transação Prisma.
 */

import type { JWK } from 'jose';
import { config } from '../../config/env';
import { prisma } from '../../prisma/client';
import { STATUS_CHAVE, statusChavePublicavelNoJwks } from '../../shared/domain/status';
import { ChaveDeAssinaturaIndisponivelError } from '../../shared/errors';
import { EVENTOS_AUDITORIA, registrarAuditoria } from '../../shared/logging';
import { vaultClient } from '../../vault';
import type { VaultClient } from '../../vault/client';
import { caminhoChavePrivada } from '../../vault/paths';
import { ChavePrivadaCache } from './key-cache';
import { chavePublicaParaJwk, gerarParDeChaves } from './rsa-key';

export interface ChaveDeAssinatura {
  kid: string;
  algoritmo: string;
  chavePrivadaPem: string;
}

/**
 * Chave pública de um `kid`, para validar tokens (inclusive antigos).
 *
 * Carrega também o algoritmo **registrado** para a chave: a validação nunca
 * deve confiar no `alg` que veio no cabeçalho do token.
 */
export interface ChavePublicaRegistrada {
  kid: string;
  algoritmo: string;
  chavePublicaPem: string;
}

const STATUS_PUBLICAVEIS = [STATUS_CHAVE.ATIVA, STATUS_CHAVE.EM_ROTACAO];

type ChaveJwtDb = typeof prisma;

export class KeyManagerService {
  private readonly cache: ChavePrivadaCache;

  constructor(
    private readonly db: ChaveJwtDb = prisma,
    private readonly vault: VaultClient = vaultClient,
    private readonly minutosDeGraca: number = config.keyRotationGraceMinutes,
    cache?: ChavePrivadaCache,
  ) {
    this.cache = cache ?? new ChavePrivadaCache();
  }

  // -- assinatura ---------------------------------------------------------

  async obterChaveDeAssinatura(): Promise<ChaveDeAssinatura> {
    const chave = await this.db.chaveJwt.findFirst({ where: { status: STATUS_CHAVE.ATIVA } });
    if (!chave) {
      throw new ChaveDeAssinaturaIndisponivelError(
        'Nenhuma chave JWT ativa cadastrada; execute o bootstrap ou a rotação',
      );
    }

    let privada = this.cache.obter(chave.kid);
    if (privada === null) {
      const segredo = await this.vault.lerSegredo(caminhoChavePrivada(chave.kid));
      const chavePrivadaPem = segredo?.chavePrivadaPem;
      if (!chavePrivadaPem || typeof chavePrivadaPem !== 'string') {
        throw new ChaveDeAssinaturaIndisponivelError(
          `Chave privada do kid ${chave.kid} não encontrada no Vault`,
        );
      }
      privada = chavePrivadaPem;
      this.cache.guardar(chave.kid, privada);
    }

    return { kid: chave.kid, algoritmo: chave.algoritmo, chavePrivadaPem: privada };
  }

  // -- validação / publicação ----------------------------------------------

  async obterChavePublica(kid: string): Promise<ChavePublicaRegistrada | null> {
    const chave = await this.db.chaveJwt.findUnique({ where: { kid } });
    if (!chave || !statusChavePublicavelNoJwks(chave.status)) {
      return null;
    }
    return { kid: chave.kid, algoritmo: chave.algoritmo, chavePublicaPem: chave.chavePublicaPem };
  }

  /** JWKS montado apenas com o PostgreSQL — não depende do Vault. */
  async obterJwks(): Promise<{ keys: JWK[] }> {
    const chaves = await this.db.chaveJwt.findMany({
      where: { status: { in: STATUS_PUBLICAVEIS } },
      orderBy: { criadoEm: 'desc' },
    });

    const keys = await Promise.all(
      chaves.map((chave) => chavePublicaParaJwk(chave.chavePublicaPem, chave.kid, chave.algoritmo)),
    );
    return { keys };
  }

  // -- ciclo de vida --------------------------------------------------------

  /** Cria a primeira chave se ainda não houver nenhuma ativa (bootstrap). */
  async garantirChaveAtiva() {
    const existente = await this.db.chaveJwt.findFirst({
      where: { status: STATUS_CHAVE.ATIVA },
    });
    if (existente) {
      return existente;
    }
    return this.rotacionar();
  }

  /**
   * Gera uma nova chave ativa e coloca a anterior em rotação.
   *
   * A chave privada vai para o Vault antes de qualquer escrita no banco: se
   * a transação não for confirmada, sobra apenas um segredo órfão, sem
   * `kid` publicado — inofensivo.
   */
  async rotacionar() {
    const par = await gerarParDeChaves();
    await this.vault.gravarSegredo(caminhoChavePrivada(par.kid), {
      chavePrivadaPem: par.chavePrivadaPem,
    });

    const anterior = await this.db.chaveJwt.findFirst({
      where: { status: STATUS_CHAVE.ATIVA },
    });

    const nova = await this.db.$transaction(async (tx) => {
      if (anterior) {
        const expiraEm = new Date(Date.now() + this.minutosDeGraca * 60_000);
        await tx.chaveJwt.update({
          where: { kid: anterior.kid },
          data: { status: STATUS_CHAVE.EM_ROTACAO, expiraEm },
        });
      }

      return tx.chaveJwt.create({
        data: {
          kid: par.kid,
          chavePublicaPem: par.chavePublicaPem,
          algoritmo: par.algoritmo,
          status: STATUS_CHAVE.ATIVA,
        },
      });
    });

    this.cache.guardar(par.kid, par.chavePrivadaPem);

    registrarAuditoria(EVENTOS_AUDITORIA.CHAVE_ROTACIONADA, 'Nova chave de assinatura ativa', {
      kid: nova.kid,
      kidAnterior: anterior?.kid ?? null,
    });
    return nova;
  }

  /** Tira do JWKS as chaves em rotação cujo período de graça acabou. */
  async aposentarChavesExpiradas(): Promise<string[]> {
    const candidatas = await this.db.chaveJwt.findMany({
      where: { status: STATUS_CHAVE.EM_ROTACAO, expiraEm: { lte: new Date() } },
    });

    const aposentadas: string[] = [];
    for (const chave of candidatas) {
      await this.db.chaveJwt.update({
        where: { kid: chave.kid },
        data: { status: STATUS_CHAVE.APOSENTADA },
      });
      await this.vault.removerSegredo(caminhoChavePrivada(chave.kid));
      this.cache.invalidar(chave.kid);
      aposentadas.push(chave.kid);
    }

    if (aposentadas.length > 0) {
      registrarAuditoria(
        EVENTOS_AUDITORIA.CHAVE_ROTACIONADA,
        'Chaves aposentadas após o período de graça',
        { kids: aposentadas },
      );
    }
    return aposentadas;
  }
}

/** Instância compartilhada pela aplicação. */
export const keyManager = new KeyManagerService();
