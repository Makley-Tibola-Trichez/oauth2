"""JWKS, introspection, healthcheck e documentação."""

from __future__ import annotations

import httpx
import pytest

from tests.integration.conftest import CABECALHO_ADMIN

pytestmark = pytest.mark.integracao


async def test_jwks_publica_a_chave_ativa(
    cliente_http: httpx.AsyncClient,
    chave_ativa: str,
) -> None:
    resposta = await cliente_http.get("/.well-known/jwks.json")

    assert resposta.status_code == 200
    chaves = resposta.json()["keys"]
    assert [c["kid"] for c in chaves] == [chave_ativa]
    assert chaves[0]["kty"] == "RSA"
    assert chaves[0]["alg"] == "RS256"
    assert "d" not in chaves[0]  # jamais expor componente privada
    assert "max-age" in resposta.headers["Cache-Control"]


async def test_introspeccao_de_token_valido(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    client_id, secret = credenciais_servico
    token = (
        await cliente_http.post(
            "/oauth/service/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": secret,
            },
        )
    ).json()["access_token"]

    resposta = await cliente_http.post(
        "/oauth/introspect",
        data={"client_id": client_id, "client_secret": secret, "token": token},
    )

    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["active"] is True
    assert corpo["sub"] == client_id
    assert corpo["tipo"] == "service"


async def test_introspeccao_exige_cliente_autenticado(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    resposta = await cliente_http.post("/oauth/introspect", data={"token": "qualquer"})

    assert resposta.status_code == 401


async def test_token_invalido_responde_apenas_active_false(
    cliente_http: httpx.AsyncClient,
    credenciais_servico: tuple[str, str],
) -> None:
    client_id, secret = credenciais_servico

    resposta = await cliente_http.post(
        "/oauth/introspect",
        data={"client_id": client_id, "client_secret": secret, "token": "nao-e-um-token"},
    )

    assert resposta.status_code == 200
    assert resposta.json() == {"active": False}


async def test_revogacao_reflete_na_introspeccao(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
    credenciais_servico: tuple[str, str],
) -> None:
    """Ganho da validação centralizada: o JWT continua íntegro, mas o titular caiu."""
    client_id, secret = credenciais_rpa
    token = (
        await cliente_http.post(
            "/oauth/rpa/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": secret,
                "rpa_id": "rpa_custeio",
            },
        )
    ).json()["access_token"]

    consultante_id, consultante_secret = credenciais_servico
    corpo = {
        "client_id": consultante_id,
        "client_secret": consultante_secret,
        "token": token,
    }

    assert (await cliente_http.post("/oauth/introspect", data=corpo)).json()["active"] is True

    await cliente_http.post("/oauth/rpas/rpa_custeio/revoke", headers=CABECALHO_ADMIN)

    assert (await cliente_http.post("/oauth/introspect", data=corpo)).json() == {"active": False}


async def test_health_reporta_as_dependencias(cliente_http: httpx.AsyncClient) -> None:
    corpo = (await cliente_http.get("/health")).json()

    assert corpo["status"] == "ok"
    assert corpo["componentes"] == {"banco_de_dados": "ok", "vault": "ok"}


async def test_documentacao_usa_scalar(cliente_http: httpx.AsyncClient) -> None:
    assert (await cliente_http.get("/scalar")).status_code == 200
    assert (await cliente_http.get("/openapi.json")).status_code == 200
    assert (await cliente_http.get("/docs")).status_code == 404
    assert (await cliente_http.get("/redoc")).status_code == 404
