import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_ACESSO, TIPO_CLIENTE } from '../../common/domain/status.enums';
import { CredenciaisInvalidasError } from '../../common/errors';
import { AuditLogService } from '../../common/logging';
import type { Cliente } from '../../generated/prisma/client';
import type { ClientesService } from '../clientes';
import { TIPO_TOKEN, type TokenEmitido, type TokenService } from '../token-service';
import { OauthServiceService } from './oauth-service.service';

const CLIENTE: Cliente = {
  id: '1',
  clientId: 'svc_faturamento',
  clientSecretHash: 'x',
  nome: 'Faturamento',
  descricao: null,
  tipo: TIPO_CLIENTE.SERVICO,
  status: STATUS_ACESSO.ATIVO,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  secretRotacionadoEm: null,
  revogadoEm: null,
};

const TOKEN: TokenEmitido = {
  accessToken: 'token-fake',
  tokenType: 'Bearer',
  expiresIn: 1800,
  jti: 'jti-1',
  expiraEm: new Date(),
  kid: 'kid-1',
};

describe('OauthServiceService', () => {
  it('emite token para o microsserviço autenticado', async () => {
    const clientesService = mock<ClientesService>();
    clientesService.autenticarCliente.mockResolvedValue(CLIENTE);
    const tokenService = mock<TokenService>();
    tokenService.emitir.mockResolvedValue(TOKEN);

    const servico = new OauthServiceService(clientesService, tokenService, mock<AuditLogService>());
    const token = await servico.emitirToken('svc_faturamento', 'secret');

    expect(token).toBe(TOKEN);
    expect(clientesService.autenticarCliente).toHaveBeenCalledWith(
      'svc_faturamento',
      'secret',
      TIPO_CLIENTE.SERVICO,
    );
    expect(tokenService.emitir).toHaveBeenCalledWith({
      sub: 'svc_faturamento',
      tipo: TIPO_TOKEN.SERVICE,
    });
  });

  it('propaga a falha de autenticação', async () => {
    const clientesService = mock<ClientesService>();
    clientesService.autenticarCliente.mockRejectedValue(new CredenciaisInvalidasError());
    const tokenService = mock<TokenService>();

    const servico = new OauthServiceService(clientesService, tokenService, mock<AuditLogService>());

    await expect(servico.emitirToken('svc_faturamento', 'errado')).rejects.toThrow(
      CredenciaisInvalidasError,
    );
    expect(tokenService.emitir).not.toHaveBeenCalled();
  });
});
