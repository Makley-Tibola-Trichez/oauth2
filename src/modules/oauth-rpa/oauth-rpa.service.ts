import { Injectable } from '@nestjs/common';
import { statusPermiteEmitirToken, TIPO_CLIENTE } from '../../common/domain/status.enums';
import { AcessoBloqueadoError, RpaNaoAutorizadaError } from '../../common/errors';
import { AuditLogService, EVENTOS_AUDITORIA } from '../../common/logging';
import { caminhoRpa, VaultService } from '../../vault';
import { ClientesService } from '../clientes';
import { RpasService } from '../rpas';
import { TIPO_TOKEN, type TokenEmitido, TokenService } from '../token-service';

/**
 * Emissão de token para RPAs.
 *
 * O `rpaId` chega pela requisição e **não é confiável**: só vira claim
 * depois de confirmado no Vault e no cadastro.
 */
@Injectable()
export class OauthRpaService {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly rpasService: RpasService,
    private readonly vault: VaultService,
    private readonly tokenService: TokenService,
    private readonly auditLog: AuditLogService,
  ) {}

  async emitirToken(clientId: string, clientSecret: string, rpaId: string): Promise<TokenEmitido> {
    const cliente = await this.clientesService.autenticarCliente(
      clientId,
      clientSecret,
      TIPO_CLIENTE.RPA,
    );
    await this.garantirRpaAutorizada(rpaId, cliente.clientId);

    const token = await this.tokenService.emitir({
      sub: cliente.clientId,
      tipo: TIPO_TOKEN.RPA,
      rpaId,
    });

    this.auditLog.registrar(EVENTOS_AUDITORIA.AUTENTICACAO_SUCESSO, 'Token emitido para RPA', {
      clientId: cliente.clientId,
      rpaId,
      tipo: TIPO_TOKEN.RPA,
      jti: token.jti,
      kid: token.kid,
    });
    return token;
  }

  /** Confirma o `rpaId` no Vault e o cadastro/status no PostgreSQL. */
  private async garantirRpaAutorizada(rpaId: string, clientId: string): Promise<void> {
    if (!(await this.vault.existe(caminhoRpa(rpaId)))) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
        'rpa_id não autorizado no Vault',
        { clientId, rpaId, motivo: 'rpa_nao_encontrada_no_vault' },
      );
      throw new RpaNaoAutorizadaError('rpa_id não autorizado');
    }

    const rpa = await this.rpasService.buscar(rpaId);
    if (!rpa) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
        'rpa_id sem cadastro correspondente',
        { clientId, rpaId, motivo: 'rpa_nao_cadastrada' },
      );
      throw new RpaNaoAutorizadaError('rpa_id não autorizado');
    }

    if (!statusPermiteEmitirToken(rpa.status)) {
      this.auditLog.registrarFalha(
        EVENTOS_AUDITORIA.AUTENTICACAO_FALHA,
        'RPA sem permissão para obter token',
        { clientId, rpaId, statusRpa: rpa.status, motivo: 'rpa_bloqueada' },
      );
      throw new AcessoBloqueadoError(`RPA com status '${rpa.status}' não pode obter token`);
    }
  }
}
