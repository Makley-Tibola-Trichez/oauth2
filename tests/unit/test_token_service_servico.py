"""Autenticação de microsserviço (OAuth2 Client Credentials)."""

from __future__ import annotations

import pytest

from app.models.cliente import Cliente
from app.models.enums import StatusAcesso
from app.security.jwt_service import ServicoJwt, TipoToken
from app.services.erros import AcessoBloqueadoError, CredenciaisInvalidasError
from app.services.token_service import ServicoToken
from tests.fakes import FakeClienteRepositorio
from tests.unit.conftest import SECRET_RPA, SECRET_SERVICO


async def test_emite_token_para_microsservico(
    servico_token: ServicoToken,
    servico_jwt: ServicoJwt,
) -> None:
    token = await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)

    claims = await servico_jwt.validar(token.access_token)
    assert claims.tipo is TipoToken.SERVICE
    assert claims.sub == "svc_faturamento"
    assert claims.rpa_id is None
    assert token.expires_in == 30 * 60


async def test_recusa_secret_invalido(servico_token: ServicoToken) -> None:
    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_servico("svc_faturamento", "secret-errado")


async def test_recusa_cliente_rpa_no_fluxo_de_servico(servico_token: ServicoToken) -> None:
    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_servico("app_rpa", SECRET_RPA)


@pytest.mark.parametrize("status", [StatusAcesso.INATIVO, StatusAcesso.REVOGADO])
async def test_recusa_cliente_bloqueado(
    servico_token: ServicoToken,
    cliente_repositorio: FakeClienteRepositorio,
    status: StatusAcesso,
) -> None:
    cliente: Cliente = cliente_repositorio.itens["svc_faturamento"]
    cliente.status = status

    with pytest.raises(AcessoBloqueadoError):
        await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)


async def test_autenticacao_generica_aceita_qualquer_tipo(servico_token: ServicoToken) -> None:
    """Usada pela introspection, que exige cliente autenticado mas não um tipo específico."""
    cliente = await servico_token.autenticar_cliente("app_rpa", SECRET_RPA)
    assert cliente.client_id == "app_rpa"

    cliente = await servico_token.autenticar_cliente("svc_faturamento", SECRET_SERVICO)
    assert cliente.client_id == "svc_faturamento"
