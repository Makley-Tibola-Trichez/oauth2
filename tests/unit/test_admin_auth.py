"""Autorização administrativa e a troca de implementação prevista para o Entra ID."""

from __future__ import annotations

import pytest

from app.config import Settings
from app.security.admin_auth import (
    AutenticadorAdmin,
    AutenticadorAdminEntraId,
    AutenticadorAdminTokenEstatico,
    CredencialAdminInvalidaError,
    criar_autenticador_admin,
)

TOKEN = "token-administrativo-de-teste"


async def test_aceita_token_correto() -> None:
    autenticador = AutenticadorAdminTokenEstatico(TOKEN)

    identidade = await autenticador.autenticar(TOKEN)

    assert identidade.origem == "static"
    assert identidade.identificador == "administrador-local"


@pytest.mark.parametrize("credencial", [None, "", "token-errado", TOKEN + "x", TOKEN.upper()])
async def test_recusa_credencial_invalida(credencial: str | None) -> None:
    autenticador = AutenticadorAdminTokenEstatico(TOKEN)

    with pytest.raises(CredencialAdminInvalidaError):
        await autenticador.autenticar(credencial)


def test_exige_token_configurado() -> None:
    with pytest.raises(ValueError, match="não configurado"):
        AutenticadorAdminTokenEstatico("")


def test_factory_escolhe_a_implementacao_estatica() -> None:
    settings = Settings(admin_auth_mode="static", admin_token=TOKEN)

    autenticador = criar_autenticador_admin(settings)

    assert isinstance(autenticador, AutenticadorAdminTokenEstatico)
    assert isinstance(autenticador, AutenticadorAdmin)


def test_factory_escolhe_o_entra_id() -> None:
    settings = Settings(
        admin_auth_mode="entraid",
        entra_tenant_id="tenant-123",
        entra_client_id="client-456",
    )

    autenticador = criar_autenticador_admin(settings)

    assert isinstance(autenticador, AutenticadorAdminEntraId)
    assert autenticador.tenant_id in autenticador.url_jwks
    assert autenticador.issuer_esperado.endswith("/v2.0")


async def test_entra_id_falha_de_forma_explicita_enquanto_nao_homologado() -> None:
    """Melhor recusar do que aceitar credencial sem verificação."""
    autenticador = AutenticadorAdminEntraId(tenant_id="t", client_id="c")

    with pytest.raises(NotImplementedError):
        await autenticador.autenticar("qualquer-token")


def test_settings_exige_token_no_modo_estatico() -> None:
    with pytest.raises(ValueError, match="ADMIN_TOKEN"):
        Settings(admin_auth_mode="static", admin_token=None, _env_file=None)


def test_settings_exige_dados_do_tenant_no_modo_entraid() -> None:
    with pytest.raises(ValueError, match="ENTRA_TENANT_ID"):
        Settings(admin_auth_mode="entraid", entra_tenant_id=None, _env_file=None)
