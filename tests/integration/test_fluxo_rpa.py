"""Fluxo completo da RPA: token, credenciais e revogação."""

from __future__ import annotations

import httpx
import jwt as pyjwt
import pytest

from tests.integration.conftest import CABECALHO_ADMIN

pytestmark = pytest.mark.integracao


async def obter_token(
    cliente_http: httpx.AsyncClient,
    credenciais: tuple[str, str],
    rpa_id: str = "rpa_custeio",
) -> httpx.Response:
    client_id, secret = credenciais
    return await cliente_http.post(
        "/oauth/rpa/token",
        data={
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": secret,
            "rpa_id": rpa_id,
        },
    )


async def test_emite_token_e_valida_pelo_jwks(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    resposta = await obter_token(cliente_http, credenciais_rpa)

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["token_type"] == "Bearer"
    assert corpo["expires_in"] == 1800

    jwks = (await cliente_http.get("/.well-known/jwks.json")).json()
    chave = pyjwt.PyJWK.from_dict(jwks["keys"][0])
    claims = pyjwt.decode(
        corpo["access_token"],
        chave.key,
        algorithms=["RS256"],
        issuer="https://auth.testes",
        audience="microservicos-de-teste",
    )
    assert claims["tipo"] == "rpa"
    assert claims["rpa_id"] == "rpa_custeio"
    assert claims["sub"] == "app_rpa"


async def test_recusa_rpa_id_nao_autorizado(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    resposta = await obter_token(cliente_http, credenciais_rpa, rpa_id="rpa_inventada")

    assert resposta.status_code == 400
    assert resposta.json()["error"] == "invalid_request"


async def test_recusa_secret_invalido(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    resposta = await obter_token(cliente_http, (credenciais_rpa[0], "secret-errado"))

    assert resposta.status_code == 401
    assert resposta.json()["error"] == "invalid_client"
    assert resposta.headers["WWW-Authenticate"] == "Bearer"


async def test_rpa_consulta_as_proprias_credenciais(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    token = (await obter_token(cliente_http, credenciais_rpa)).json()["access_token"]

    resposta = await cliente_http.get(
        "/oauth/rpas/rpa_custeio/credentials",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resposta.status_code == 200
    assert resposta.json()["credenciais"]["usuario"] == "rpa.custeio"


async def test_credenciais_exigem_token(cliente_http: httpx.AsyncClient) -> None:
    assert (await cliente_http.get("/oauth/rpas/rpa_custeio/credentials")).status_code == 401


async def test_revogacao_bloqueia_novos_tokens(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    assert (await obter_token(cliente_http, credenciais_rpa)).status_code == 200

    revogacao = await cliente_http.post("/oauth/rpas/rpa_custeio/revoke", headers=CABECALHO_ADMIN)
    assert revogacao.json()["status"] == "revogado"

    assert (await obter_token(cliente_http, credenciais_rpa)).status_code == 400
