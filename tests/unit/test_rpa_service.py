"""Cadastro de RPAs, revogação e acesso às credenciais guardadas no Vault."""

from __future__ import annotations

import pytest

from app.models.enums import StatusAcesso
from app.schemas.rpa import RpaCriacaoRequest
from app.security.admin_auth import IdentidadeAdmin
from app.security.jwt_service import ClaimsToken, ServicoJwt, TipoToken
from app.services.erros import (
    AcessoBloqueadoError,
    OperacaoNaoPermitidaError,
    RecursoDuplicadoError,
    RecursoNaoEncontradoError,
)
from app.services.rpa_service import ServicoRpa
from app.services.token_service import ServicoToken
from app.vault.caminhos import caminho_rpa
from app.vault.fake_client import FakeVaultClient
from tests.fakes import FakeRpaRepositorio
from tests.unit.conftest import SECRET_RPA

ADMIN = IdentidadeAdmin(identificador="admin-de-teste", origem="static")


@pytest.fixture
def servico_rpa(rpa_repositorio: FakeRpaRepositorio, vault: FakeVaultClient) -> ServicoRpa:
    return ServicoRpa(rpa_repositorio, vault)


async def claims_da_rpa(servico_jwt: ServicoJwt, rpa_id: str) -> ClaimsToken:
    emitido = await servico_jwt.emitir(sub="app_rpa", tipo=TipoToken.RPA, rpa_id=rpa_id)
    return await servico_jwt.validar(emitido.access_token)


async def test_cadastro_grava_credenciais_no_vault_e_nao_no_banco(
    servico_rpa: ServicoRpa,
    vault: FakeVaultClient,
) -> None:
    dados = RpaCriacaoRequest(
        rpa_id="rpa_folha",
        nome="RPA da Folha",
        credenciais={"usuario": "rpa.folha", "senha": "segredo"},
    )

    rpa = await servico_rpa.criar(dados, ADMIN)

    assert StatusAcesso(rpa.status) is StatusAcesso.ATIVO
    assert "senha" not in rpa.model_dump()

    segredo = await vault.ler_segredo(caminho_rpa("rpa_folha"))
    assert segredo is not None
    assert segredo["credenciais"]["senha"] == "segredo"


async def test_cadastro_autoriza_a_emissao_de_token(
    servico_rpa: ServicoRpa,
    servico_token: ServicoToken,
) -> None:
    await servico_rpa.criar(RpaCriacaoRequest(rpa_id="rpa_nova", nome="RPA Nova"), ADMIN)

    token = await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_nova")
    assert token.access_token


async def test_recusa_rpa_id_duplicado(servico_rpa: ServicoRpa) -> None:
    with pytest.raises(RecursoDuplicadoError):
        await servico_rpa.criar(RpaCriacaoRequest(rpa_id="rpa_custeio", nome="Duplicada"), ADMIN)


async def test_revogacao_remove_a_autorizacao_do_vault(
    servico_rpa: ServicoRpa,
    vault: FakeVaultClient,
    servico_token: ServicoToken,
) -> None:
    rpa = await servico_rpa.revogar("rpa_custeio", ADMIN)

    assert StatusAcesso(rpa.status) is StatusAcesso.REVOGADO
    assert await vault.ler_segredo(caminho_rpa("rpa_custeio")) is None

    from app.services.erros import RpaNaoAutorizadaError

    with pytest.raises(RpaNaoAutorizadaError):
        await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_custeio")


async def test_rpa_le_as_proprias_credenciais(
    servico_rpa: ServicoRpa,
    servico_jwt: ServicoJwt,
) -> None:
    claims = await claims_da_rpa(servico_jwt, "rpa_custeio")

    credenciais = await servico_rpa.obter_credenciais("rpa_custeio", claims)

    assert credenciais == {"usuario": "rpa.custeio"}


async def test_rpa_nao_le_credenciais_de_outra(
    servico_rpa: ServicoRpa,
    servico_jwt: ServicoJwt,
) -> None:
    await servico_rpa.criar(RpaCriacaoRequest(rpa_id="rpa_alheia", nome="Alheia"), ADMIN)
    claims = await claims_da_rpa(servico_jwt, "rpa_custeio")

    with pytest.raises(OperacaoNaoPermitidaError):
        await servico_rpa.obter_credenciais("rpa_alheia", claims)


async def test_token_de_microsservico_nao_acessa_credenciais(
    servico_rpa: ServicoRpa,
    servico_jwt: ServicoJwt,
) -> None:
    emitido = await servico_jwt.emitir(sub="svc_faturamento", tipo=TipoToken.SERVICE)
    claims = await servico_jwt.validar(emitido.access_token)

    with pytest.raises(OperacaoNaoPermitidaError):
        await servico_rpa.obter_credenciais("rpa_custeio", claims)


async def test_rpa_revogada_nao_acessa_credenciais(
    servico_rpa: ServicoRpa,
    servico_jwt: ServicoJwt,
    rpa_repositorio: FakeRpaRepositorio,
) -> None:
    claims = await claims_da_rpa(servico_jwt, "rpa_custeio")
    rpa_repositorio.itens["rpa_custeio"].status = StatusAcesso.REVOGADO

    with pytest.raises(AcessoBloqueadoError):
        await servico_rpa.obter_credenciais("rpa_custeio", claims)


async def test_rpa_sem_cadastro_nao_acessa_credenciais(
    servico_rpa: ServicoRpa,
    servico_jwt: ServicoJwt,
    rpa_repositorio: FakeRpaRepositorio,
) -> None:
    claims = await claims_da_rpa(servico_jwt, "rpa_custeio")
    del rpa_repositorio.itens["rpa_custeio"]

    with pytest.raises(RecursoNaoEncontradoError):
        await servico_rpa.obter_credenciais("rpa_custeio", claims)
