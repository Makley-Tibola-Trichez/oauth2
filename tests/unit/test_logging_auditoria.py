"""Auditoria: nenhum segredo pode chegar ao log."""

from __future__ import annotations

import json
import logging

import pytest

from app.observability.logging import (
    VALOR_REDIGIDO,
    FiltroRedacao,
    FormatadorJson,
    campo_e_sensivel,
)


def _registro(**campos: object) -> logging.LogRecord:
    registro = logging.LogRecord(
        name="app.teste",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Evento de teste",
        args=(),
        exc_info=None,
    )
    registro.__dict__.update(campos)
    return registro


def formatar(**campos: object) -> dict:
    registro = _registro(**campos)
    FiltroRedacao().filter(registro)
    return json.loads(FormatadorJson().format(registro))


@pytest.mark.parametrize(
    "campo",
    [
        "client_secret",
        "client_secret_hash",
        "access_token",
        "refresh_token",
        "vault_token",
        "chave_privada_pem",
        "senha",
        "password",
        "authorization",
        "api_key",
        "credenciais",
    ],
)
def test_campos_proibidos_sao_redigidos(campo: str) -> None:
    saida = formatar(**{campo: "valor-secreto"})

    assert saida[campo] == VALOR_REDIGIDO
    assert "valor-secreto" not in json.dumps(saida)


def test_redige_dentro_de_estruturas_aninhadas() -> None:
    saida = formatar(
        contexto={
            "client_id": "svc_x",
            "dados": [{"client_secret": "abc"}, {"ok": "visivel"}],
        }
    )

    assert saida["contexto"]["dados"][0]["client_secret"] == VALOR_REDIGIDO
    assert saida["contexto"]["dados"][1]["ok"] == "visivel"
    assert saida["contexto"]["client_id"] == "svc_x"


def test_mantem_campos_de_negocio() -> None:
    saida = formatar(evento="autenticacao_sucesso", client_id="app_rpa", rpa_id="rpa_custeio")

    assert saida["evento"] == "autenticacao_sucesso"
    assert saida["client_id"] == "app_rpa"
    assert saida["rpa_id"] == "rpa_custeio"
    assert saida["nivel"] == "INFO"
    assert saida["logger"] == "app.teste"
    assert saida["mensagem"] == "Evento de teste"


def test_nao_redige_termos_oauth_inofensivos() -> None:
    saida = formatar(token_type="Bearer", grant_type="client_credentials")

    assert saida["token_type"] == "Bearer"
    assert saida["grant_type"] == "client_credentials"


def test_saida_e_json_de_uma_linha() -> None:
    registro = _registro(evento="teste")
    linha = FormatadorJson().format(registro)

    assert "\n" not in linha
    assert json.loads(linha)["timestamp"].endswith("+00:00")


@pytest.mark.parametrize(
    ("campo", "sensivel"),
    [
        ("client_secret", True),
        ("CLIENT_SECRET", True),
        ("secret_rotacionado_em", True),
        ("token_type", False),
        ("client_id", False),
        ("rpa_id", False),
        ("jti", False),
    ],
)
def test_classificacao_dos_campos(campo: str, sensivel: bool) -> None:
    assert campo_e_sensivel(campo) is sensivel
