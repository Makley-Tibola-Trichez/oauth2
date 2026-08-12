import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_ACESSO, TIPO_CLIENTE } from '../../common/domain/status.enums';
import {
  AcessoBloqueadoError,
  CredenciaisInvalidasError,
  RecursoDuplicadoError,
  RecursoNaoEncontradoError,
} from '../../common/errors';
import { AuditLogService } from '../../common/logging';
import type { Cliente } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { HashingService, SecretGeneratorService } from '../hashing';
import { ClientesService } from './clientes.service';

const ADMIN = { identificador: 'admin-teste', origem: 'static' };

function criarCliente(sobrescritas: Partial<Cliente> = {}): Cliente {
  return {
    id: 'uuid-1',
    clientId: 'svc_x',
    clientSecretHash: 'hash',
    nome: 'Serviço X',
    descricao: null,
    tipo: TIPO_CLIENTE.SERVICO,
    status: STATUS_ACESSO.ATIVO,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    secretRotacionadoEm: null,
    revogadoEm: null,
    ...sobrescritas,
  };
}

function criarAmbiente() {
  const linhas = new Map<string, Cliente>();
  const prisma = {
    cliente: {
      findUnique: vi.fn(
        async ({ where }: { where: { clientId: string } }) => linhas.get(where.clientId) ?? null,
      ),
      create: vi.fn(async ({ data }: { data: Partial<Cliente> & { clientId: string } }) => {
        const cliente = criarCliente(data);
        linhas.set(cliente.clientId, cliente);
        return cliente;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { clientId: string }; data: Partial<Cliente> }) => {
          const atual = linhas.get(where.clientId);
          if (!atual) throw new Error('não encontrado');
          const atualizado = { ...atual, ...data };
          linhas.set(where.clientId, atualizado);
          return atualizado;
        },
      ),
      findMany: vi.fn(async () => [...linhas.values()]),
    },
  } as unknown as PrismaService;

  const servico = new ClientesService(
    prisma,
    new HashingService(),
    new SecretGeneratorService(),
    mock<AuditLogService>(),
  );

  return { servico, linhas };
}

describe('ClientesService', () => {
  let servico: ClientesService;
  let linhas: Map<string, Cliente>;

  beforeEach(() => {
    ({ servico, linhas } = criarAmbiente());
  });

  it('cria cliente guardando apenas o hash do secret', async () => {
    const { cliente, secret } = await servico.criar(
      { nome: 'Serviço Novo', tipo: TIPO_CLIENTE.SERVICO, clientId: 'svc_novo' },
      ADMIN,
    );

    expect(cliente.status).toBe(STATUS_ACESSO.ATIVO);
    expect(cliente.clientSecretHash).not.toBe(secret);
    expect(secret.length).toBeGreaterThanOrEqual(60);
  });

  it('gera client_id quando omitido', async () => {
    const { cliente } = await servico.criar({ nome: 'Sem Id', tipo: TIPO_CLIENTE.SERVICO }, ADMIN);
    expect(cliente.clientId.startsWith('servico_')).toBe(true);
  });

  it('recusa client_id duplicado', async () => {
    linhas.set('app_rpa', criarCliente({ clientId: 'app_rpa' }));

    await expect(
      servico.criar({ clientId: 'app_rpa', nome: 'Dup', tipo: TIPO_CLIENTE.RPA }, ADMIN),
    ).rejects.toThrow(RecursoDuplicadoError);
  });

  it('obter lança quando o cliente não existe', async () => {
    await expect(servico.obter('nao_existe')).rejects.toThrow(RecursoNaoEncontradoError);
    expect(await servico.buscar('nao_existe')).toBeNull();
  });

  it('rotação de secret invalida o anterior', async () => {
    const { secret: secretOriginal } = await servico.criar(
      { clientId: 'svc_x', nome: 'X', tipo: TIPO_CLIENTE.SERVICO },
      ADMIN,
    );

    const { cliente, secret: novoSecret } = await servico.rotacionarSecret('svc_x', ADMIN);

    expect(cliente.secretRotacionadoEm).not.toBeNull();
    expect(novoSecret).not.toBe(secretOriginal);
    await expect(servico.autenticarCliente('svc_x', secretOriginal)).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    await expect(servico.autenticarCliente('svc_x', novoSecret)).resolves.toBeTruthy();
  });

  it('revogação bloqueia autenticação e é idempotente', async () => {
    await servico.criar({ clientId: 'svc_x', nome: 'X', tipo: TIPO_CLIENTE.SERVICO }, ADMIN);

    const primeira = await servico.revogar('svc_x', ADMIN);
    const segunda = await servico.revogar('svc_x', ADMIN);

    expect(primeira.revogadoEm).toEqual(segunda.revogadoEm);
    expect(primeira.status).toBe(STATUS_ACESSO.REVOGADO);
  });

  describe('autenticarCliente', () => {
    it('aceita credenciais corretas', async () => {
      const { secret } = await servico.criar(
        { clientId: 'svc_x', nome: 'X', tipo: TIPO_CLIENTE.SERVICO },
        ADMIN,
      );
      const cliente = await servico.autenticarCliente('svc_x', secret);
      expect(cliente.clientId).toBe('svc_x');
    });

    it('recusa client_id inexistente', async () => {
      await expect(servico.autenticarCliente('nao_existe', 'qualquer')).rejects.toThrow(
        CredenciaisInvalidasError,
      );
    });

    it('recusa secret incorreto', async () => {
      await servico.criar({ clientId: 'svc_x', nome: 'X', tipo: TIPO_CLIENTE.SERVICO }, ADMIN);
      await expect(servico.autenticarCliente('svc_x', 'secret-errado')).rejects.toThrow(
        CredenciaisInvalidasError,
      );
    });

    it('recusa quando o tipo não bate com o esperado', async () => {
      const { secret } = await servico.criar(
        { clientId: 'app_rpa', nome: 'RPA', tipo: TIPO_CLIENTE.RPA },
        ADMIN,
      );
      await expect(
        servico.autenticarCliente('app_rpa', secret, TIPO_CLIENTE.SERVICO),
      ).rejects.toThrow(CredenciaisInvalidasError);
    });

    it('aceita qualquer tipo quando tipoEsperado é omitido', async () => {
      const { secret } = await servico.criar(
        { clientId: 'app_rpa', nome: 'RPA', tipo: TIPO_CLIENTE.RPA },
        ADMIN,
      );
      await expect(servico.autenticarCliente('app_rpa', secret)).resolves.toBeTruthy();
    });

    it('recusa cliente revogado', async () => {
      const { secret } = await servico.criar(
        { clientId: 'svc_x', nome: 'X', tipo: TIPO_CLIENTE.SERVICO },
        ADMIN,
      );
      await servico.revogar('svc_x', ADMIN);

      await expect(servico.autenticarCliente('svc_x', secret)).rejects.toThrow(
        AcessoBloqueadoError,
      );
    });
  });
});
