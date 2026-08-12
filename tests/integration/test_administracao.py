"""Endpoints administrativos e a exigência de autenticação."""

from __future__ import annotations

import httpx
import pytest

from tests.integration.conftest import CABECALHO_ADMIN

pytestmark = pytest.mark.integracao

NOVO_CLIENTE = {"client_id": "svc_novo", "nome": "Serviço Novo", "tipo": "servico"}


@pytest.mark.parametrize(
    ("metodo", "rota"),
    [
        ("post", "/oauth/clients"),
        ("get", "/oauth/clients/svc_novo"),
        ("post", "/oauth/clients/svc_novo/rotate-secret"),
        ("post", "/oauth/clients/svc_novo/revoke"),
        ("post", "/oauth/rpas"),
        ("get", "/oauth/rpas/rpa_custeio"),
        ("post", "/oauth/rpas/rpa_custeio/revoke"),
    ],
)
async def test_endpoints_administrativos_exigem_credencial(
    cliente_http: httpx.AsyncClient,
    metodo: str,
    rota: str,
) -> None:
    sem_credencial = await cliente_http.request(metodo, rota, json={})
    assert sem_credencial.status_code == 401

    credencial_errada = await cliente_http.request(
        metodo, rota, json={}, headers={"Authorization": "Bearer token-errado"}
    )
    assert credencial_errada.status_code == 401


async def test_criacao_devolve_o_secret_uma_unica_vez(cliente_http: httpx.AsyncClient) -> None:
    criacao = await cliente_http.post("/oauth/clients", json=NOVO_CLIENTE, headers=CABECALHO_ADMIN)

    assert criacao.status_code == 201
    corpo = criacao.json()
    assert len(corpo["client_secret"]) >= 60
    assert corpo["status"] == "ativo"

    consulta = (await cliente_http.get("/oauth/clients/svc_novo", headers=CABECALHO_ADMIN)).json()
    assert "client_secret" not in consulta
    assert "client_secret_hash" not in consulta


async def test_recusa_client_id_duplicado(cliente_http: httpx.AsyncClient) -> None:
    await cliente_http.post("/oauth/clients", json=NOVO_CLIENTE, headers=CABECALHO_ADMIN)

    duplicado = await cliente_http.post(
        "/oauth/clients", json=NOVO_CLIENTE, headers=CABECALHO_ADMIN
    )

    assert duplicado.status_code == 409


async def test_cliente_inexistente(cliente_http: httpx.AsyncClient) -> None:
    resposta = await cliente_http.get("/oauth/clients/nao_existe", headers=CABECALHO_ADMIN)

    assert resposta.status_code == 404


async def test_rotacao_invalida_o_secret_anterior(cliente_http: httpx.AsyncClient) -> None:
    criacao = await cliente_http.post("/oauth/clients", json=NOVO_CLIENTE, headers=CABECALHO_ADMIN)
    secret_antigo = criacao.json()["client_secret"]

    rotacao = await cliente_http.post(
        "/oauth/clients/svc_novo/rotate-secret", headers=CABECALHO_ADMIN
    )
    secret_novo = rotacao.json()["client_secret"]

    assert rotacao.status_code == 200
    assert secret_novo != secret_antigo

    def corpo(secret: str) -> dict[str, str]:
        return {
            "grant_type": "client_credentials",
            "client_id": "svc_novo",
            "client_secret": secret,
        }

    assert (
        await cliente_http.post("/oauth/service/token", data=corpo(secret_antigo))
    ).status_code == 401
    assert (
        await cliente_http.post("/oauth/service/token", data=corpo(secret_novo))
    ).status_code == 200


async def test_cadastro_de_rpa_autoriza_a_emissao(
    cliente_http: httpx.AsyncClient,
    credenciais_rpa: tuple[str, str],
) -> None:
    client_id, secret = credenciais_rpa
    corpo_token = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": secret,
        "rpa_id": "rpa_folha",
    }

    assert (await cliente_http.post("/oauth/rpa/token", data=corpo_token)).status_code == 400

    criacao = await cliente_http.post(
        "/oauth/rpas",
        json={"rpa_id": "rpa_folha", "nome": "RPA da Folha", "credenciais": {"chave": "valor"}},
        headers=CABECALHO_ADMIN,
    )
    assert criacao.status_code == 201

    assert (await cliente_http.post("/oauth/rpa/token", data=corpo_token)).status_code == 200


async def test_revogacao_de_cliente_e_idempotente(cliente_http: httpx.AsyncClient) -> None:
    await cliente_http.post("/oauth/clients", json=NOVO_CLIENTE, headers=CABECALHO_ADMIN)

    primeira = await cliente_http.post("/oauth/clients/svc_novo/revoke", headers=CABECALHO_ADMIN)
    segunda = await cliente_http.post("/oauth/clients/svc_novo/revoke", headers=CABECALHO_ADMIN)

    assert primeira.json()["revogado_em"] == segunda.json()["revogado_em"]
