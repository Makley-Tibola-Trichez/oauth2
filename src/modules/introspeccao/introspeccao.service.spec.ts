import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { STATUS_ACESSO, TIPO_CLIENTE } from '../../common/domain/status.enums';
import { AuditLogService } from '../../common/logging';
import type { Cliente, Rpa } from '../../generated/prisma/client';
import type { ClientesService } from '../clientes';
import type { RpasService } from '../rpas';
import {
  type ClaimsToken,
  TIPO_TOKEN,
  TokenInvalidoError,
  type TokenService,
} from '../token-service';
import { IntrospeccaoService } from './introspeccao.service';

const CLAIMS_SERVICE: ClaimsToken = {
  sub: 'svc_faturamento',
  tipo: TIPO_TOKEN.SERVICE,
  iss: 'https://auth',
  aud: 'aud',
  iat: new Date(0),
  exp: new Date(1_000_000),
  jti: 'jti-1',
};

const CLAIMS_RPA: ClaimsToken = {
  ...CLAIMS_SERVICE,
  sub: 'app_rpa',
  tipo: TIPO_TOKEN.RPA,
  rpaId: 'rpa_custeio',
};

const CLIENTE_ATIVO: Cliente = {
  id: '1',
  clientId: 'svc_faturamento',
  clientSecretHash: 'x',
  nome: 'X',
  descricao: null,
  tipo: TIPO_CLIENTE.SERVICO,
  status: STATUS_ACESSO.ATIVO,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  secretRotacionadoEm: null,
  revogadoEm: null,
};

const RPA_ATIVA: Rpa = {
  id: '1',
  rpaId: 'rpa_custeio',
  nome: 'X',
  descricao: null,
  status: STATUS_ACESSO.ATIVO,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  revogadoEm: null,
};

function criarAmbiente() {
  const tokenService = mock<TokenService>();
  const clientesService = mock<ClientesService>();
  const rpasService = mock<RpasService>();
  const servico = new IntrospeccaoService(
    tokenService,
    clientesService,
    rpasService,
    mock<AuditLogService>(),
  );
  return { servico, tokenService, clientesService, rpasService };
}

describe('IntrospeccaoService', () => {
  it('token de microsserviço válido retorna active:true com os claims', async () => {
    const { servico, tokenService, clientesService } = criarAmbiente();
    tokenService.validar.mockResolvedValue(CLAIMS_SERVICE);
    clientesService.buscar.mockResolvedValue(CLIENTE_ATIVO);

    const resposta = await servico.introspectar('token-valido');

    expect(resposta).toEqual({
      active: true,
      sub: 'svc_faturamento',
      tipo: TIPO_TOKEN.SERVICE,
      rpaId: undefined,
      client_id: 'svc_faturamento',
      iss: 'https://auth',
      aud: 'aud',
      iat: 0,
      exp: 1000,
      jti: 'jti-1',
      token_type: 'Bearer',
    });
  });

  it('token de RPA válido inclui rpaId', async () => {
    const { servico, tokenService, clientesService, rpasService } = criarAmbiente();
    tokenService.validar.mockResolvedValue(CLAIMS_RPA);
    clientesService.buscar.mockResolvedValue({
      ...CLIENTE_ATIVO,
      clientId: 'app_rpa',
      tipo: TIPO_CLIENTE.RPA,
    });
    rpasService.buscar.mockResolvedValue(RPA_ATIVA);

    const resposta = await servico.introspectar('token-rpa');

    expect(resposta.active).toBe(true);
    expect(resposta.rpaId).toBe('rpa_custeio');
  });

  it('token malformado retorna apenas active:false', async () => {
    const { servico, tokenService } = criarAmbiente();
    tokenService.validar.mockRejectedValue(new TokenInvalidoError('inválido'));

    expect(await servico.introspectar('lixo')).toEqual({ active: false });
  });

  it('cliente revogado após a emissão torna o token inativo', async () => {
    const { servico, tokenService, clientesService } = criarAmbiente();
    tokenService.validar.mockResolvedValue(CLAIMS_SERVICE);
    clientesService.buscar.mockResolvedValue({ ...CLIENTE_ATIVO, status: STATUS_ACESSO.REVOGADO });

    expect(await servico.introspectar('token-valido')).toEqual({ active: false });
  });

  it('RPA revogada após a emissão torna o token inativo', async () => {
    const { servico, tokenService, clientesService, rpasService } = criarAmbiente();
    tokenService.validar.mockResolvedValue(CLAIMS_RPA);
    clientesService.buscar.mockResolvedValue({
      ...CLIENTE_ATIVO,
      clientId: 'app_rpa',
      tipo: TIPO_CLIENTE.RPA,
    });
    rpasService.buscar.mockResolvedValue({ ...RPA_ATIVA, status: STATUS_ACESSO.REVOGADO });

    expect(await servico.introspectar('token-rpa')).toEqual({ active: false });
  });

  it('cliente inexistente torna o token inativo', async () => {
    const { servico, tokenService, clientesService } = criarAmbiente();
    tokenService.validar.mockResolvedValue(CLAIMS_SERVICE);
    clientesService.buscar.mockResolvedValue(null);

    expect(await servico.introspectar('token-valido')).toEqual({ active: false });
  });
});
