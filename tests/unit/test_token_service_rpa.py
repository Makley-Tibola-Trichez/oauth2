"""Autenticação de RPA: credencial compartilhada + validação do rpa_id no Vault."""

from __future__ import annotations

import pytest

from app.models.enums import StatusAcesso
from app.models.rpa import Rpa
from app.security.jwt_service import ServicoJwt, TipoToken
from app.services.erros import (
    AcessoBloqueadoError,
    CredenciaisInvalidasError,
    RpaNaoAutorizadaError,
)
from app.services.token_service import ServicoToken
from app.vault.caminhos import caminho_rpa
from app.vault.fake_client import FakeVaultClient
from tests.fakes import FakeRpaRepositorio
from tests.unit.conftest import SECRET_RPA, SECRET_SERVICO


async def test_emite_token_com_rpa_id_autorizado(
    servico_token: ServicoToken,
    servico_jwt: ServicoJwt,
) -> None:
    token = await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_custeio")

    claims = await servico_jwt.validar(token.access_token)
    assert claims.tipo is TipoToken.RPA
    assert claims.rpa_id == "rpa_custeio"
    assert claims.sub == "app_rpa"
    assert claims.jti


async def test_recusa_rpa_id_ausente_no_vault(servico_token: ServicoToken) -> None:
    """O rpa_id vem da requisição e não é confiável: sem registro no Vault, não há token."""
    with pytest.raises(RpaNaoAutorizadaError):
        await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_inventada")


async def test_recusa_rpa_autorizada_no_vault_mas_sem_cadastro(
    servico_token: ServicoToken,
    vault: FakeVaultClient,
) -> None:
    await vault.gravar_segredo(caminho_rpa("rpa_orfa"), {"credenciais": {}})

    with pytest.raises(RpaNaoAutorizadaError):
        await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_orfa")


@pytest.mark.parametrize("status", [StatusAcesso.INATIVO, StatusAcesso.REVOGADO])
async def test_recusa_rpa_bloqueada(
    servico_token: ServicoToken,
    rpa_repositorio: FakeRpaRepositorio,
    status: StatusAcesso,
) -> None:
    rpa: Rpa = rpa_repositorio.itens["rpa_custeio"]
    rpa.status = status

    with pytest.raises(AcessoBloqueadoError):
        await servico_token.emitir_para_rpa("app_rpa", SECRET_RPA, "rpa_custeio")


async def test_recusa_secret_invalido(servico_token: ServicoToken) -> None:
    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_rpa("app_rpa", "secret-errado", "rpa_custeio")


async def test_recusa_client_id_inexistente(servico_token: ServicoToken) -> None:
    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_rpa("nao_existe", SECRET_RPA, "rpa_custeio")


async def test_recusa_cliente_de_microsservico_no_fluxo_de_rpa(
    servico_token: ServicoToken,
) -> None:
    """Um cliente tipo `servico` não pode usar o endpoint das RPAs."""
    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_rpa("svc_faturamento", SECRET_SERVICO, "rpa_custeio")


async def test_nao_consulta_vault_antes_de_validar_o_secret(
    servico_token: ServicoToken,
    vault: FakeVaultClient,
) -> None:
    """Credencial inválida falha antes de qualquer acesso ao cofre."""
    vault.disponivel = False

    with pytest.raises(CredenciaisInvalidasError):
        await servico_token.emitir_para_rpa("app_rpa", "secret-errado", "rpa_custeio")
