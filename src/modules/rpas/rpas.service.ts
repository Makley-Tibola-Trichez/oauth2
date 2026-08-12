import { Injectable } from '@nestjs/common';
import { STATUS_ACESSO, statusPermiteEmitirToken } from '../../common/domain/status.enums';
import {
  AcessoBloqueadoError,
  OperacaoNaoPermitidaError,
  RecursoDuplicadoError,
  RecursoNaoEncontradoError,
} from '../../common/errors';
import { AuditLogService, EVENTOS_AUDITORIA } from '../../common/logging';
import type { Rpa } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { caminhoRpa, VaultService } from '../../vault';
import type { IdentidadeAdmin } from '../admin-auth';
import type { ClaimsToken } from '../token-service';
import { TIPO_TOKEN } from '../token-service';
import type { CriarRpaDto } from './dto/criar-rpa.dto';

/**
 * Regras de gestão das RPAs e do acesso às suas credenciais.
 *
 * O cadastro e o status ficam no PostgreSQL; a autorização do `rpaId` e as
 * credenciais ficam no Vault. As duas fontes precisam concordar.
 */
@Injectable()
export class RpasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vault: VaultService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Cadastra a RPA e a autoriza no Vault.
   *
   * O segredo é gravado antes do registro no banco: se a escrita no
   * PostgreSQL falhar, sobra um caminho no Vault sem cadastro
   * correspondente — e a emissão de token exige as duas coisas, então nada
   * é liberado indevidamente.
   */
  async criar(dados: CriarRpaDto, admin: IdentidadeAdmin): Promise<Rpa> {
    if (await this.buscar(dados.rpaId)) {
      throw new RecursoDuplicadoError(`Já existe uma RPA com rpa_id '${dados.rpaId}'`);
    }

    await this.vault.gravarSegredo(caminhoRpa(dados.rpaId), {
      credenciais: dados.credenciais,
      criadoEm: new Date().toISOString(),
    });

    const rpa = await this.prisma.rpa.create({
      data: {
        rpaId: dados.rpaId,
        nome: dados.nome,
        descricao: dados.descricao,
        status: STATUS_ACESSO.ATIVO,
      },
    });

    this.auditLog.registrar(EVENTOS_AUDITORIA.RPA_CRIADA, 'RPA cadastrada e autorizada no Vault', {
      rpaId: rpa.rpaId,
      admin: admin.identificador,
      origemAdmin: admin.origem,
    });
    return rpa;
  }

  async buscar(rpaId: string): Promise<Rpa | null> {
    return this.prisma.rpa.findUnique({ where: { rpaId } });
  }

  async obter(rpaId: string): Promise<Rpa> {
    const rpa = await this.buscar(rpaId);
    if (!rpa) {
      throw new RecursoNaoEncontradoError(`RPA '${rpaId}' não encontrada`);
    }
    return rpa;
  }

  /** Revoga a RPA no banco e retira a autorização do Vault. */
  async revogar(rpaId: string, admin: IdentidadeAdmin): Promise<Rpa> {
    let rpa = await this.obter(rpaId);

    if (rpa.status !== STATUS_ACESSO.REVOGADO) {
      rpa = await this.prisma.rpa.update({
        where: { rpaId },
        data: { status: STATUS_ACESSO.REVOGADO, revogadoEm: new Date() },
      });
    }
    await this.vault.removerSegredo(caminhoRpa(rpaId));

    this.auditLog.registrar(EVENTOS_AUDITORIA.ACESSO_REVOGADO, 'RPA revogada e removida do Vault', {
      rpaId: rpa.rpaId,
      admin: admin.identificador,
      origemAdmin: admin.origem,
    });
    return rpa;
  }

  async listar(): Promise<Rpa[]> {
    return this.prisma.rpa.findMany({ orderBy: { criadoEm: 'asc' } });
  }

  /** Entrega as credenciais do Vault para a própria RPA autenticada. */
  async obterCredenciais(rpaId: string, claims: ClaimsToken): Promise<Record<string, unknown>> {
    if (claims.tipo !== TIPO_TOKEN.RPA || claims.rpaId !== rpaId) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.CREDENCIAIS_ACESSADAS,
        'Tentativa de ler credenciais de outra RPA',
        { rpaIdSolicitado: rpaId, rpaIdDoToken: claims.rpaId, sub: claims.sub },
      );
      throw new OperacaoNaoPermitidaError('O token não autoriza acesso às credenciais desta RPA');
    }

    const rpa = await this.obter(rpaId);
    if (!statusPermiteEmitirToken(rpa.status)) {
      throw new AcessoBloqueadoError(`RPA com status '${rpa.status}' não pode acessar credenciais`);
    }

    const segredo = await this.vault.lerSegredo(caminhoRpa(rpaId));
    if (!segredo) {
      throw new RecursoNaoEncontradoError(`Não há credenciais armazenadas para a RPA '${rpaId}'`);
    }

    this.auditLog.registrar(
      EVENTOS_AUDITORIA.CREDENCIAIS_ACESSADAS,
      'Credenciais da RPA consultadas',
      {
        rpaId,
        sub: claims.sub,
        jti: claims.jti,
      },
    );
    return (segredo.credenciais as Record<string, unknown>) ?? {};
  }
}
