import { Injectable } from '@nestjs/common';
import { STATUS_ACESSO } from '../../common/domain/status.enums';
import { AuditLogService, EVENTOS_AUDITORIA } from '../../common/logging';
import { ClientesService } from '../clientes';
import { RpasService } from '../rpas';
import { type ClaimsToken, TIPO_TOKEN, TokenInvalidoError, TokenService } from '../token-service';
import type { IntrospeccaoRespostaDto } from './dto/introspeccao-resposta.dto';

const INATIVO: IntrospeccaoRespostaDto = { active: false };

/**
 * Introspection (RFC 7662) — validação centralizada e opcional.
 *
 * A validação normal é local, feita pelos microsserviços com a chave
 * pública do JWKS. O valor deste endpoint é enxergar o que o JWT sozinho
 * não mostra: se o cliente ou a RPA foram revogados depois da emissão.
 */
@Injectable()
export class IntrospeccaoService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly clientesService: ClientesService,
    private readonly rpasService: RpasService,
    private readonly auditLog: AuditLogService,
  ) {}

  async introspectar(token: string, solicitante?: string): Promise<IntrospeccaoRespostaDto> {
    let claims: ClaimsToken;
    try {
      claims = await this.tokenService.validar(token);
    } catch (erro) {
      this.auditLog.registrar(
        EVENTOS_AUDITORIA.INTROSPECCAO,
        'Token inspecionado considerado inativo',
        {
          solicitante,
          motivo: erro instanceof TokenInvalidoError ? erro.message : 'erro desconhecido',
          ativo: false,
        },
      );
      return INATIVO;
    }

    if (!(await this.sujeitoContinuaAtivo(claims))) {
      this.auditLog.registrar(
        EVENTOS_AUDITORIA.INTROSPECCAO,
        'Token válido, porém o titular está inativo ou revogado',
        { solicitante, sub: claims.sub, rpaId: claims.rpaId, jti: claims.jti, ativo: false },
      );
      return INATIVO;
    }

    this.auditLog.registrar(
      EVENTOS_AUDITORIA.INTROSPECCAO,
      'Token inspecionado e considerado ativo',
      {
        solicitante,
        sub: claims.sub,
        rpaId: claims.rpaId,
        jti: claims.jti,
        ativo: true,
      },
    );
    return {
      active: true,
      sub: claims.sub,
      tipo: claims.tipo,
      rpaId: claims.rpaId,
      client_id: claims.sub,
      iss: claims.iss,
      aud: claims.aud,
      iat: Math.floor(claims.iat.getTime() / 1000),
      exp: Math.floor(claims.exp.getTime() / 1000),
      jti: claims.jti,
      token_type: 'Bearer',
    };
  }

  private async sujeitoContinuaAtivo(claims: ClaimsToken): Promise<boolean> {
    const cliente = await this.clientesService.buscar(claims.sub);
    if (!cliente || cliente.status !== STATUS_ACESSO.ATIVO) {
      return false;
    }

    if (claims.tipo === TIPO_TOKEN.RPA) {
      if (!claims.rpaId) {
        return false;
      }
      const rpa = await this.rpasService.buscar(claims.rpaId);
      if (!rpa || rpa.status !== STATUS_ACESSO.ATIVO) {
        return false;
      }
    }

    return true;
  }
}
