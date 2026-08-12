import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_CHAVE } from '../../common/domain/status.enums';
import { AuditLogService } from '../../common/logging';
import { AppConfigService } from '../../config/app-config.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { caminhoChavePrivada, VaultFakeService } from '../../vault';
import { ChaveDeAssinaturaIndisponivelError } from './chaves-jwt.errors';
import { KeyManagerService } from './key-manager.service';

interface RegistroChave {
  kid: string;
  chavePublicaPem: string;
  algoritmo: string;
  status: string;
  criadoEm: Date;
  expiraEm: Date | null;
}

function correspondeStatus(linha: RegistroChave, condicao: unknown): boolean {
  if (condicao === undefined) return true;
  if (typeof condicao === 'string') return linha.status === condicao;
  const emLista = (condicao as { in?: string[] }).in;
  return emLista ? emLista.includes(linha.status) : true;
}

function correspondeExpiraEm(linha: RegistroChave, condicao: unknown): boolean {
  const lte = (condicao as { lte?: Date } | undefined)?.lte;
  if (!lte) return true;
  return linha.expiraEm !== null && linha.expiraEm <= lte;
}

/** Fake mínimo do delegate `prisma.chaveJwt`, o bastante para exercitar o KeyManagerService. */
function criarPrismaFake() {
  const linhas = new Map<string, RegistroChave>();

  const chaveJwt = {
    findFirst: vi.fn(async ({ where }: { where?: { status?: unknown } } = {}) => {
      for (const linha of linhas.values()) {
        if (correspondeStatus(linha, where?.status)) return { ...linha };
      }
      return null;
    }),
    findUnique: vi.fn(async ({ where }: { where: { kid: string } }) => {
      const linha = linhas.get(where.kid);
      return linha ? { ...linha } : null;
    }),
    findMany: vi.fn(async ({ where }: { where?: { status?: unknown; expiraEm?: unknown } } = {}) =>
      [...linhas.values()]
        .filter(
          (l) => correspondeStatus(l, where?.status) && correspondeExpiraEm(l, where?.expiraEm),
        )
        .map((l) => ({ ...l })),
    ),
    create: vi.fn(async ({ data }: { data: Partial<RegistroChave> & { kid: string } }) => {
      const linha: RegistroChave = {
        chavePublicaPem: '',
        algoritmo: 'RS256',
        status: STATUS_CHAVE.ATIVA,
        criadoEm: new Date(),
        expiraEm: null,
        ...data,
      };
      linhas.set(linha.kid, linha);
      return { ...linha };
    }),
    update: vi.fn(
      async ({ where, data }: { where: { kid: string }; data: Partial<RegistroChave> }) => {
        const linha = linhas.get(where.kid);
        if (!linha) throw new Error(`chave ${where.kid} não encontrada`);
        Object.assign(linha, data);
        return { ...linha };
      },
    ),
  };

  const prisma = {
    chaveJwt,
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  } as unknown as PrismaService;

  return { prisma, linhas };
}

describe('KeyManagerService', () => {
  let prisma: PrismaService;
  let linhas: Map<string, RegistroChave>;
  let vault: VaultFakeService;
  let servico: KeyManagerService;

  beforeEach(() => {
    ({ prisma, linhas } = criarPrismaFake());
    vault = new VaultFakeService();
    const config = mock<AppConfigService>({ keyRotationGraceMinutes: 35 });
    const auditLog = mock<AuditLogService>();
    servico = new KeyManagerService(prisma, vault, config, auditLog);
  });

  it('a chave privada fica apenas no Vault', async () => {
    const chave = await servico.garantirChaveAtiva();

    const registro = linhas.get(chave.kid);
    expect(registro?.chavePublicaPem).toContain('PUBLIC KEY');
    expect(registro?.chavePublicaPem).not.toContain('PRIVATE KEY');

    const segredo = await vault.lerSegredo(caminhoChavePrivada(chave.kid));
    expect(String(segredo?.chavePrivadaPem)).toContain('PRIVATE KEY');
  });

  it('o JWKS não depende do Vault', async () => {
    await servico.garantirChaveAtiva();
    vault.disponivel = false;

    const jwks = await servico.obterJwks();

    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0].kty).toBe('RSA');
    expect(jwks.keys[0]).toHaveProperty('kid');
    expect(jwks.keys[0]).toHaveProperty('n');
  });

  it('a rotação troca a chave ativa e mantém a anterior no JWKS', async () => {
    const anterior = await servico.garantirChaveAtiva();

    const nova = await servico.rotacionar();

    expect(nova.kid).not.toBe(anterior.kid);
    expect(nova.status).toBe(STATUS_CHAVE.ATIVA);
    expect(linhas.get(anterior.kid)?.status).toBe(STATUS_CHAVE.EM_ROTACAO);
    expect(linhas.get(anterior.kid)?.expiraEm).not.toBeNull();

    const kidsPublicados = (await servico.obterJwks()).keys.map((k) => k.kid);
    expect(new Set(kidsPublicados)).toEqual(new Set([anterior.kid, nova.kid]));
  });

  it('chave aposentada some do Vault e do JWKS', async () => {
    const antiga = await servico.garantirChaveAtiva();
    await servico.rotacionar();

    const registroAntiga = linhas.get(antiga.kid);
    if (registroAntiga) registroAntiga.expiraEm = new Date(Date.now() - 60_000);

    const aposentadas = await servico.aposentarChavesExpiradas();

    expect(aposentadas).toEqual([antiga.kid]);
    expect(linhas.get(antiga.kid)?.status).toBe(STATUS_CHAVE.APOSENTADA);
    expect(await vault.lerSegredo(caminhoChavePrivada(antiga.kid))).toBeNull();
    expect((await servico.obterJwks()).keys).toHaveLength(1);
  });

  it('não aposenta chaves antes do período de graça', async () => {
    await servico.garantirChaveAtiva();
    await servico.rotacionar();

    expect(await servico.aposentarChavesExpiradas()).toEqual([]);
    expect((await servico.obterJwks()).keys).toHaveLength(2);
  });

  it('garantirChaveAtiva é idempotente', async () => {
    const primeira = await servico.garantirChaveAtiva();
    const segunda = await servico.garantirChaveAtiva();

    expect(primeira.kid).toBe(segunda.kid);
    expect(linhas.size).toBe(1);
  });

  it('falha explicitamente quando não há chave cadastrada', async () => {
    await expect(servico.obterChaveDeAssinatura()).rejects.toThrow(
      ChaveDeAssinaturaIndisponivelError,
    );
  });

  it('falha explicitamente quando a privada some do Vault', async () => {
    const chave = await servico.garantirChaveAtiva();
    await vault.removerSegredo(caminhoChavePrivada(chave.kid));

    // outra instância, sem o cache já aquecido da primeira
    const outraInstancia = new KeyManagerService(
      prisma,
      vault,
      mock<AppConfigService>({ keyRotationGraceMinutes: 35 }),
      mock<AuditLogService>(),
    );

    await expect(outraInstancia.obterChaveDeAssinatura()).rejects.toThrow(
      ChaveDeAssinaturaIndisponivelError,
    );
  });

  it('chave desconhecida não é retornada por obterChavePublica', async () => {
    expect(await servico.obterChavePublica('kid-inexistente')).toBeNull();

    const chave = await servico.garantirChaveAtiva();
    expect(await servico.obterChavePublica(chave.kid)).not.toBeNull();
  });
});
