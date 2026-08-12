import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_ACESSO, TIPO_CLIENTE } from '../../common/domain/status.enums';
import {
  AcessoBloqueadoError,
  CredenciaisInvalidasError,
  RpaNaoAutorizadaError,
} from '../../common/errors';
import { AuditLogService } from '../../common/logging';
import type { Cliente, Rpa } from '../../generated/prisma/client';
import { caminhoRpa, VaultFakeService } from '../../vault';
import type { ClientesService } from '../clientes';
import type { RpasService } from '../rpas';
import { TIPO_TOKEN, type TokenEmitido, type TokenService } from '../token-service';
import { OauthRpaService } from './oauth-rpa.service';

const CLIENTE: Cliente = {
  id: '1',
  clientId: 'app_rpa',
  clientSecretHash: 'x',
  nome: 'RPAs',
  descricao: null,
  tipo: TIPO_CLIENTE.RPA,
  status: STATUS_ACESSO.ATIVO,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  secretRotacionadoEm: null,
  revogadoEm: null,
};

const RPA: Rpa = {
  id: '1',
  rpaId: 'rpa_custeio',
  nome: 'Custeio',
  descricao: null,
  status: STATUS_ACESSO.ATIVO,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
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

function criarAmbiente() {
  const clientesService = mock<ClientesService>();
  clientesService.autenticarCliente.mockResolvedValue(CLIENTE);

  const rpasService = mock<RpasService>();
  rpasService.buscar.mockResolvedValue(RPA);

  const vault = new VaultFakeService({ [caminhoRpa('rpa_custeio')]: { credenciais: {} } });

  const tokenService = mock<TokenService>();
  tokenService.emitir.mockResolvedValue(TOKEN);

  const servico = new OauthRpaService(
    clientesService,
    rpasService,
    vault,
    tokenService,
    mock<AuditLogService>(),
  );

  return { servico, clientesService, rpasService, vault, tokenService };
}

describe('OauthRpaService', () => {
  it('emite token quando o rpa_id está autorizado no Vault e cadastrado', async () => {
    const { servico, tokenService } = criarAmbiente();

    const token = await servico.emitirToken('app_rpa', 'secret', 'rpa_custeio');

    expect(token).toBe(TOKEN);
    expect(tokenService.emitir).toHaveBeenCalledWith({
      sub: 'app_rpa',
      tipo: TIPO_TOKEN.RPA,
      rpaId: 'rpa_custeio',
    });
  });

  it('propaga a falha de autenticação do cliente sem consultar o Vault', async () => {
    const { servico, clientesService, vault } = criarAmbiente();
    clientesService.autenticarCliente.mockRejectedValue(new CredenciaisInvalidasError());
    vault.disponivel = false;

    await expect(servico.emitirToken('app_rpa', 'errado', 'rpa_custeio')).rejects.toThrow(
      CredenciaisInvalidasError,
    );
  });

  it('recusa rpa_id ausente no Vault', async () => {
    const { servico } = criarAmbiente();

    await expect(servico.emitirToken('app_rpa', 'secret', 'rpa_inventada')).rejects.toThrow(
      RpaNaoAutorizadaError,
    );
  });

  it('recusa rpa_id autorizado no Vault mas sem cadastro', async () => {
    const { servico, rpasService, vault } = criarAmbiente();
    rpasService.buscar.mockResolvedValue(null);
    await vault.gravarSegredo(caminhoRpa('rpa_orfa'), { credenciais: {} });

    await expect(servico.emitirToken('app_rpa', 'secret', 'rpa_orfa')).rejects.toThrow(
      RpaNaoAutorizadaError,
    );
  });

  it('recusa RPA bloqueada', async () => {
    const { servico, rpasService } = criarAmbiente();
    rpasService.buscar.mockResolvedValue({ ...RPA, status: STATUS_ACESSO.REVOGADO });

    await expect(servico.emitirToken('app_rpa', 'secret', 'rpa_custeio')).rejects.toThrow(
      AcessoBloqueadoError,
    );
  });
});
