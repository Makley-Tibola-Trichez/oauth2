"""Geração criptograficamente segura de credenciais OAuth2."""

from __future__ import annotations

import secrets

# 48 bytes de entropia -> 64 caracteres em base64url.
TAMANHO_SECRET_BYTES = 48


def gerar_client_secret(tamanho_bytes: int = TAMANHO_SECRET_BYTES) -> str:
    """Novo ``client_secret``. Só é exibido uma vez; o banco guarda o hash."""
    return secrets.token_urlsafe(tamanho_bytes)


def gerar_client_id(prefixo: str = "app") -> str:
    """``client_id`` legível quando o administrador não informa um."""
    return f"{prefixo.strip('_')}_{secrets.token_hex(8)}"
