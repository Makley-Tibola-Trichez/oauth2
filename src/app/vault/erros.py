"""Erros da integração com o Vault."""

from __future__ import annotations


class VaultError(Exception):
    """Falha genérica ao falar com o cofre de segredos."""


class VaultIndisponivelError(VaultError):
    """O cofre não respondeu ou respondeu com erro de infraestrutura."""


class VaultPermissaoError(VaultError):
    """O token da aplicação não tem permissão sobre o caminho solicitado."""
