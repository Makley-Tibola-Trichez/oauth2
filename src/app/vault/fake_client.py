"""Cofre em memória, usado nos testes para não depender do Vault real."""

from __future__ import annotations

import copy
from typing import Any

from app.vault.client import VaultClient
from app.vault.erros import VaultIndisponivelError


class FakeVaultClient(VaultClient):
    def __init__(
        self,
        segredos: dict[str, dict[str, Any]] | None = None,
        *,
        disponivel: bool = True,
    ) -> None:
        self.segredos: dict[str, dict[str, Any]] = copy.deepcopy(segredos or {})
        self.disponivel = disponivel

    def _garantir_disponivel(self) -> None:
        if not self.disponivel:
            raise VaultIndisponivelError("Vault fake configurado como indisponível")

    @staticmethod
    def _normalizar(caminho: str) -> str:
        return caminho.strip("/")

    async def ler_segredo(self, caminho: str) -> dict[str, Any] | None:
        self._garantir_disponivel()
        valor = self.segredos.get(self._normalizar(caminho))
        return copy.deepcopy(valor) if valor is not None else None

    async def gravar_segredo(self, caminho: str, dados: dict[str, Any]) -> None:
        self._garantir_disponivel()
        self.segredos[self._normalizar(caminho)] = copy.deepcopy(dados)

    async def remover_segredo(self, caminho: str) -> None:
        self._garantir_disponivel()
        self.segredos.pop(self._normalizar(caminho), None)

    async def verificar_saude(self) -> bool:
        return self.disponivel
