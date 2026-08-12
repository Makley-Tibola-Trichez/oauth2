import { Injectable } from '@nestjs/common';
import {
  STATUS_ACESSO,
  statusPermiteEmitirToken,
  type TipoCliente,
} from '../../common/domain/status.enums';
import {
  AcessoBloqueadoError,
  CredenciaisInvalidasError,
  RecursoDuplicadoError,
  RecursoNaoEncontradoError,
} from '../../common/errors';
import { AuditLogService, EVENTOS_AUDITORIA } from '../../common/logging';
import type { Cliente } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { IdentidadeAdmin } from '../admin-auth';
import { HashingService, SecretGeneratorService } from '../hashing';
import type { CriarClienteDto } from './dto/criar-cliente.dto';

// Hash descartável usado quando o client_id não existe, para que a resposta
// leve o mesmo tempo de um secret errado e não vire um oráculo de existência.
let hashFicticioPromise: Promise<string> | null = null;

/**
 * Regras de gestão dos clientes OAuth2 e da autenticação de clientes.
 *
 * `autenticarCliente` fica aqui (não num serviço de token à parte) porque
 * opera exclusivamente sobre dados do `Cliente` — é reutilizada pelos fluxos
 * de token de RPA/microsserviço e pela introspection.
 */
@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly secretGenerator: SecretGeneratorService,
    private readonly auditLog: AuditLogService,
  ) {}

  async criar(
    dados: CriarClienteDto,
    admin: IdentidadeAdmin,
  ): Promise<{ cliente: Cliente; secret: string }> {
    const clientId = dados.clientId ?? this.secretGenerator.gerarClientId(dados.tipo);

    if (await this.buscar(clientId)) {
      throw new RecursoDuplicadoError(`Já existe um cliente com client_id '${clientId}'`);
    }

    const secret = this.secretGenerator.gerarClientSecret();
    const cliente = await this.prisma.cliente.create({
      data: {
        clientId,
        clientSecretHash: await this.hashing.gerarHash(secret),
        nome: dados.nome,
        descricao: dados.descricao,
        tipo: dados.tipo,
        status: STATUS_ACESSO.ATIVO,
      },
    });

    this.auditLog.registrar(EVENTOS_AUDITORIA.CLIENTE_CRIADO, 'Cliente OAuth2 criado', {
      clientId: cliente.clientId,
      tipoCliente: cliente.tipo,
      admin: admin.identificador,
      origemAdmin: admin.origem,
    });
    return { cliente, secret };
  }

  async buscar(clientId: string): Promise<Cliente | null> {
    return this.prisma.cliente.findUnique({ where: { clientId } });
  }

  async obter(clientId: string): Promise<Cliente> {
    const cliente = await this.buscar(clientId);
    if (!cliente) {
      throw new RecursoNaoEncontradoError(`Cliente '${clientId}' não encontrado`);
    }
    return cliente;
  }

  async rotacionarSecret(
    clientId: string,
    admin: IdentidadeAdmin,
  ): Promise<{ cliente: Cliente; secret: string }> {
    await this.obter(clientId);

    const secret = this.secretGenerator.gerarClientSecret();
    const cliente = await this.prisma.cliente.update({
      where: { clientId },
      data: {
        clientSecretHash: await this.hashing.gerarHash(secret),
        secretRotacionadoEm: new Date(),
      },
    });

    this.auditLog.registrar(EVENTOS_AUDITORIA.SECRET_ROTACIONADO, 'client_secret rotacionado', {
      clientId: cliente.clientId,
      admin: admin.identificador,
      origemAdmin: admin.origem,
    });
    return { cliente, secret };
  }

  async revogar(clientId: string, admin: IdentidadeAdmin): Promise<Cliente> {
    let cliente = await this.obter(clientId);

    if (cliente.status !== STATUS_ACESSO.REVOGADO) {
      cliente = await this.prisma.cliente.update({
        where: { clientId },
        data: { status: STATUS_ACESSO.REVOGADO, revogadoEm: new Date() },
      });
    }

    this.auditLog.registrar(EVENTOS_AUDITORIA.ACESSO_REVOGADO, 'Cliente revogado', {
      clientId: cliente.clientId,
      admin: admin.identificador,
      origemAdmin: admin.origem,
    });
    return cliente;
  }

  async listar(): Promise<Cliente[]> {
    return this.prisma.cliente.findMany({ orderBy: { criadoEm: 'asc' } });
  }

  /**
   * Valida credenciais e status. Sem `tipoEsperado`, aceita qualquer
   * público — usada pela introspection, que exige um cliente autenticado
   * mas não se importa com o tipo dele.
   */
  async autenticarCliente(
    clientId: string,
    clientSecret: string,
    tipoEsperado?: TipoCliente,
  ): Promise<Cliente> {
    const cliente = clientId ? await this.buscar(clientId) : null;

    if (!cliente) {
      await this.hashing.verificar(clientSecret ?? '', await obterHashFicticio(this.hashing));
      this.auditLog.registrarFalha(EVENTOS_AUDITORIA.AUTENTICACAO_FALHA, 'Cliente não encontrado', {
        clientId,
        motivo: 'client_id_inexistente',
      });
      throw new CredenciaisInvalidasError();
    }

    if (!(await this.hashing.verificar(clientSecret ?? '', cliente.clientSecretHash))) {
      this.auditLog.registrarFalha(EVENTOS_AUDITORIA.AUTENTICACAO_FALHA, 'client_secret inválido', {
        clientId,
        motivo: 'secret_invalido',
      });
      throw new CredenciaisInvalidasError();
    }

    if (tipoEsperado !== undefined && cliente.tipo !== tipoEsperado) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
        'Cliente usou o fluxo de token do outro público',
        { clientId, tipoCliente: cliente.tipo, tipoEsperado, motivo: 'tipo_incompativel' },
      );
      throw new CredenciaisInvalidasError();
    }

    if (!statusPermiteEmitirToken(cliente.status)) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
        'Cliente inativo ou revogado',
        {
          clientId,
          statusCliente: cliente.status,
          motivo: 'cliente_bloqueado',
        },
      );
      throw new AcessoBloqueadoError(`Cliente com status '${cliente.status}' não pode obter token`);
    }

    return cliente;
  }
}

async function obterHashFicticio(hashing: HashingService): Promise<string> {
  if (!hashFicticioPromise) {
    hashFicticioPromise = hashing.gerarHash('cliente-inexistente');
  }
  return hashFicticioPromise;
}
