import { Injectable } from '@nestjs/common';
import { TIPO_CLIENTE } from '../../common/domain/status.enums';
import { AuditLogService, EVENTOS_AUDITORIA } from '../../common/logging';
import { ClientesService } from '../clientes';
import { TIPO_TOKEN, type TokenEmitido, TokenService } from '../token-service';

/** Emissão de token para microsserviços (OAuth2 Client Credentials). */
@Injectable()
export class OauthServiceService {
  constructor(
    private readonly clientesService: ClientesService,
    private readonly tokenService: TokenService,
    private readonly auditLog: AuditLogService,
  ) {}

  async emitirToken(clientId: string, clientSecret: string): Promise<TokenEmitido> {
    const cliente = await this.clientesService.autenticarCliente(
      clientId,
      clientSecret,
      TIPO_CLIENTE.SERVICO,
    );
    const token = await this.tokenService.emitir({
      sub: cliente.clientId,
      tipo: TIPO_TOKEN.SERVICE,
    });

    this.auditLog.registrar(
      EVENTOS_AUDITORIA.AUTENTICACAO_SUCESSO,
      'Token emitido para microsserviço',
      { clientId: cliente.clientId, tipo: TIPO_TOKEN.SERVICE, jti: token.jti, kid: token.kid },
    );
    return token;
  }
}
