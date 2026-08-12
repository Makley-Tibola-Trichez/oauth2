"""Introspection: o que o JWT sozinho não mostra."""

from __future__ import annotations

import pytest

from app.models.enums import StatusAcesso
from app.security.jwt_service import ServicoJwt, TipoToken
from app.services.introspeccao_service import ServicoIntrospeccao
from tests.fakes import FakeClienteRepositorio, FakeRpaRepositorio
from tests.unit.conftest import SECRET_RPA, SECRET_SERVICO


@pytest.fixture
def servico_introspeccao(
    servico_jwt: ServicoJwt,
    cliente_repositorio: FakeClienteRepositorio,
    rpa_repositorio: FakeRpaRepositorio,
) -> ServicoIntrospeccao:
    return ServicoIntrospeccao(servico_jwt, cliente_repositorio, rpa_repositorio)


async def test_token_de_servico_valido(
    servico_introspeccao: ServicoIntrospeccao,
    servico_token,
) -> None:
    emitido = await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)

    resposta = await servico_introspeccao.introspectar(emitido.access_token)

    assert resposta.active is True
    assert resposta.sub == "svc_faturamento"
    assert resposta.client_id == "svc_faturamento"
    assert resposta.tipo == TipoToken.SERVICE.value
    assert resposta.jti == emitido.jti
    assert resposta.rpa_id is None


async def test_token_de_rpa_valido(
    servico_introspeccao: ServicoIntrospeccao,
    servico_token,
) -> None:
    emitido = await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_custeio")

    resposta = await servico_introspeccao.introspectar(emitido.access_token)

    assert resposta.active is True
    assert resposta.rpa_id == "rpa_custeio"
    assert resposta.tipo == TipoToken.RPA.value


@pytest.mark.parametrize("token", ["", "nao-e-um-token", "a.b.c"])
async def test_token_malformado_e_inativo(
    servico_introspeccao: ServicoIntrospeccao,
    token: str,
) -> None:
    assert (await servico_introspeccao.introspectar(token)).active is False


async def test_token_adulterado_e_inativo(
    servico_introspeccao: ServicoIntrospeccao,
    servico_token,
) -> None:
    emitido = await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)

    resposta = await servico_introspeccao.introspectar(emitido.access_token[:-4] + "aaaa")

    assert resposta.active is False


async def test_cliente_revogado_apos_a_emissao_torna_o_token_inativo(
    servico_introspeccao: ServicoIntrospeccao,
    servico_token,
    cliente_repositorio: FakeClienteRepositorio,
) -> None:
    """Este é o ganho da validação centralizada sobre a validação local."""
    emitido = await servico_token.emitir_para_servico("svc_faturamento", SECRET_SERVICO)
    cliente_repositorio.itens["svc_faturamento"].status = StatusAcesso.REVOGADO

    assert (await servico_introspeccao.introspectar(emitido.access_token)).active is False


async def test_rpa_revogada_apos_a_emissao_torna_o_token_inativo(
    servico_introspeccao: ServicoIntrospeccao,
    servico_token,
    rpa_repositorio: FakeRpaRepositorio,
) -> None:
    emitido = await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_custeio")
    rpa_repositorio.itens["rpa_custeio"].status = StatusAcesso.REVOGADO

    assert (await servico_introspeccao.introspectar(emitido.access_token)).active is False
