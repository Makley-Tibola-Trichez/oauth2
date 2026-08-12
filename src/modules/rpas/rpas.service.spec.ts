import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_ACESSO } from '../../common/domain/status.enums';
import {
  AcessoBloqueadoError,
  OperacaoNaoPermitidaError,
  RecursoDuplicadoError,
  RecursoNaoEncontradoError,
} from '../../common/errors';
import { AuditLogService } from '../../common/logging';
import type { Rpa } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { caminhoRpa, VaultFakeService } from '../../vault';
import { TIPO_TOKEN } from '../token-service';
import { RpasService } from './rpas.service';

const ADMIN = { identificador: 'admin-teste', origem: 'static' };

function criarRpa(sobrescritas: Partial<Rpa> = {}): Rpa {
  return {
    id: 'uuid-1',
    rpaId: 'rpa_custeio',
    nome: 'RPA de Custeio',
    descricao: null,
    status: STATUS_ACESSO.ATIVO,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    revogadoEm: null,
    ...sobrescritas,
  };
}

function criarAmbiente() {
  const linhas = new Map<string, Rpa>();
  const prisma = {
    rpa: {
      findUnique: vi.fn(
        async ({ where }: { where: { rpaId: string } }) => linhas.get(where.rpaId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Partial<Rpa> & { rpaId: string } }) => {
        const rpa = criarRpa(data);
        linhas.set(rpa.rpaId, rpa);
        return rpa;
      }),
      update: vi.fn(async ({ where, data }: { where: { rpaId: string }; data: Partial<Rpa> }) => {
        const atual = linhas.get(where.rpaId);
        if (!atual) throw new Error('não encontrado');
        const atualizado = { ...atual, ...data };
        linhas.set(where.rpaId, atualizado);
        return atualizado;
      }),
      findMany: vi.fn(async () => [...linhas.values()]),
    },
  } as unknown as PrismaService;

  const vault = new VaultFakeService();
  const servico = new RpasService(prisma, vault, mock<AuditLogService>());

  return { servico, linhas, vault };
}

describe('RpasService', () => {
  it('cadastro grava credenciais no Vault e não no banco', async () => {
    const { servico, vault } = criarAmbiente();

    const rpa = await servico.criar(
      {
        rpaId: 'rpa_folha',
        nome: 'RPA da Folha',
        credenciais: { usuario: 'rpa.folha', senha: 's' },
      },
      ADMIN,
    );

    expect(rpa.status).toBe(STATUS_ACESSO.ATIVO);
    expect(JSON.stringify(rpa)).not.toContain('senha');

    const segredo = await vault.lerSegredo(caminhoRpa('rpa_folha'));
    expect(segredo).not.toBeNull();
    expect((segredo?.credenciais as { senha: string } | undefined)?.senha).toBe('s');
  });

  it('recusa rpa_id duplicado', async () => {
    const { servico, linhas } = criarAmbiente();
    linhas.set('rpa_custeio', criarRpa());

    await expect(
      servico.criar({ rpaId: 'rpa_custeio', nome: 'Duplicada', credenciais: {} }, ADMIN),
    ).rejects.toThrow(RecursoDuplicadoError);
  });

  it('revogação remove a autorização do Vault', async () => {
    const { servico, vault } = criarAmbiente();
    await servico.criar({ rpaId: 'rpa_custeio', nome: 'X', credenciais: {} }, ADMIN);

    const rpa = await servico.revogar('rpa_custeio', ADMIN);

    expect(rpa.status).toBe(STATUS_ACESSO.REVOGADO);
    expect(await vault.existe(caminhoRpa('rpa_custeio'))).toBe(false);
  });

  it('obter lança quando a RPA não existe', async () => {
    const { servico } = criarAmbiente();
    await expect(servico.obter('nao_existe')).rejects.toThrow(RecursoNaoEncontradoError);
  });

  describe('obterCredenciais', () => {
    it('a RPA lê as próprias credenciais', async () => {
      const { servico } = criarAmbiente();
      await servico.criar(
        { rpaId: 'rpa_custeio', nome: 'X', credenciais: { usuario: 'u' } },
        ADMIN,
      );

      const credenciais = await servico.obterCredenciais('rpa_custeio', {
        sub: 'app_rpa',
        tipo: TIPO_TOKEN.RPA,
        rpaId: 'rpa_custeio',
        iss: 'x',
        aud: 'y',
        iat: new Date(),
        exp: new Date(),
        jti: 'jti-1',
      });

      expect(credenciais).toEqual({ usuario: 'u' });
    });

    it('recusa quando o rpaId do token diverge da rota', async () => {
      const { servico } = criarAmbiente();
      await servico.criar({ rpaId: 'rpa_custeio', nome: 'X', credenciais: {} }, ADMIN);
      await servico.criar({ rpaId: 'rpa_alheia', nome: 'Y', credenciais: {} }, ADMIN);

      await expect(
        servico.obterCredenciais('rpa_alheia', {
          sub: 'app_rpa',
          tipo: TIPO_TOKEN.RPA,
          rpaId: 'rpa_custeio',
          iss: 'x',
          aud: 'y',
          iat: new Date(),
          exp: new Date(),
          jti: 'jti-1',
        }),
      ).rejects.toThrow(OperacaoNaoPermitidaError);
    });

    it('recusa token de microsserviço', async () => {
      const { servico } = criarAmbiente();
      await servico.criar({ rpaId: 'rpa_custeio', nome: 'X', credenciais: {} }, ADMIN);

      await expect(
        servico.obterCredenciais('rpa_custeio', {
          sub: 'svc_x',
          tipo: TIPO_TOKEN.SERVICE,
          iss: 'x',
          aud: 'y',
          iat: new Date(),
          exp: new Date(),
          jti: 'jti-1',
        }),
      ).rejects.toThrow(OperacaoNaoPermitidaError);
    });

    it('recusa quando a RPA está revogada', async () => {
      const { servico } = criarAmbiente();
      await servico.criar({ rpaId: 'rpa_custeio', nome: 'X', credenciais: {} }, ADMIN);
      await servico.revogar('rpa_custeio', ADMIN);

      await expect(
        servico.obterCredenciais('rpa_custeio', {
          sub: 'app_rpa',
          tipo: TIPO_TOKEN.RPA,
          rpaId: 'rpa_custeio',
          iss: 'x',
          aud: 'y',
          iat: new Date(),
          exp: new Date(),
          jti: 'jti-1',
        }),
      ).rejects.toThrow(AcessoBloqueadoError);
    });
  });
});
