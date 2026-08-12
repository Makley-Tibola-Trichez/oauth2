"""Contrato do cofre de segredos.

A aplicação nunca fala com o HashiCorp Vault diretamente: depende desta
abstração, o que permite trocar o backend (Azure Key Vault, AWS Secrets
Manager) e usar um fake em memória nos testes.

Todos os caminhos são **relativos** ao prefixo da aplicação — por exemplo
``jwt/keys/{kid}`` ou ``rpa/{rpa_id}``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class VaultClient(ABC):
    @abstractmethod
    async def ler_segredo(self, caminho: str) -> dict[str, Any] | None:
        """Retorna o conteúdo do segredo, ou ``None`` se ele não existir."""

    @abstractmethod
    async def gravar_segredo(self, caminho: str, dados: dict[str, Any]) -> None:
        """Cria ou substitui o segredo no caminho informado."""

    @abstractmethod
    async def remover_segredo(self, caminho: str) -> None:
        """Remove o segredo (e todas as suas versões). Idempotente."""

    @abstractmethod
    async def verificar_saude(self) -> bool:
        """Indica se o cofre está acessível e destravado."""

    async def existe(self, caminho: str) -> bool:
        """Presença de um segredo — é o sinal de autorização de um ``rpa_id``."""
        return await self.ler_segredo(caminho) is not None

    async def fechar(self) -> None:
        """Libera recursos (conexões HTTP, por exemplo). Sem efeito por padrão."""
        return None
