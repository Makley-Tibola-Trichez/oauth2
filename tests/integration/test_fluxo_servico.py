"""Fluxo Client Credentials dos microsserviços."""

from __future__ import annotations

import httpx
import pytest

from tests.integration.conftest import CABECALHO_ADMIN

pytestmark = pytest.mark.integracao


async def test_emite_token_com_credenciais_no_formulario(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    client_id, secret = credenciais_servico

    resposta = await cliente_http.post(
        "/oauth/service/token",
        data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret},
    )

    assert resposta.status_code == 200
    assert resposta.json()["expires_in"] == 1800


async def test_emite_token_com_autenticacao_basic(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    resposta = await cliente_http.post(
        "/oauth/service/token",
        auth=credenciais_servico,
        data={"grant_type": "client_credentials"},
    )

    assert resposta.status_code == 200


async def test_recusa_requisicao_sem_credenciais(cliente_http: httpx.AsyncClient) -> None:
    resposta = await cliente_http.post(
        "/oauth/service/token", data={"grant_type": "client_credentials"}
    )

    assert resposta.status_code == 401
    assert resposta.json()["error"] == "invalid_client"


async def test_cliente_de_rpa_nao_usa_o_fluxo_de_servico(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    client_id, secret = credenciais_rpa

    resposta = await cliente_http.post(
        "/oauth/service/token",
        data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret},
    )

    assert resposta.status_code == 401


async def test_revogacao_bloqueia_novos_tokens(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    client_id, secret = credenciais_servico
    corpo = {"grant_type": "client_credentials", "client_id": client_id, "client_secret": secret}

    assert (await cliente_http.post("/oauth/service/token", data=corpo)).status_code == 200

    await cliente_http.post(f"/oauth/clients/{client_id}/revoke", headers=CABECALHO_ADMIN)

    resposta = await cliente_http.post("/oauth/service/token", data=corpo)
    assert resposta.status_code == 403
    assert resposta.json()["error"] == "invalid_client"
