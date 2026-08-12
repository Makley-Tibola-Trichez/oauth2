"""Hash do client_secret e geração criptograficamente segura de credenciais."""

from __future__ import annotations

import pytest

from app.security.gerador_secret import gerar_client_id, gerar_client_secret
from app.security.hashing import HasherSecret


def test_hash_nao_contem_o_secret(hasher: HasherSecret) -> None:
    secret = gerar_client_secret()
    hash_gerado = hasher.gerar_hash(secret)

    assert secret not in hash_gerado
    assert hash_gerado.startswith("$argon2")


def test_verifica_secret_correto(hasher: HasherSecret) -> None:
    secret = gerar_client_secret()
    assert hasher.verificar(secret, hasher.gerar_hash(secret)) is True


@pytest.mark.parametrize(
    "candidato",
    ["secret-errado", "", " ", "SECRET"],
)
def test_recusa_secret_incorreto(hasher: HasherSecret, candidato: str) -> None:
    assert hasher.verificar(candidato, hasher.gerar_hash("secret-verdadeiro")) is False


def test_hash_invalido_nao_levanta_excecao(hasher: HasherSecret) -> None:
    assert hasher.verificar("qualquer", "isto-nao-e-um-hash") is False
    assert hasher.verificar("qualquer", "") is False


def test_mesmo_secret_gera_hashes_diferentes(hasher: HasherSecret) -> None:
    """Salt aleatório: dois hashes iguais denunciariam secrets iguais."""
    secret = gerar_client_secret()
    assert hasher.gerar_hash(secret) != hasher.gerar_hash(secret)


def test_secrets_sao_unicos_e_longos() -> None:
    secrets_gerados = {gerar_client_secret() for _ in range(200)}

    assert len(secrets_gerados) == 200
    assert all(len(s) >= 60 for s in secrets_gerados)


def test_client_id_gerado_usa_o_prefixo() -> None:
    client_id = gerar_client_id("servico")

    assert client_id.startswith("servico_")
    assert client_id != gerar_client_id("servico")
