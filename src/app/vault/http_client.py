"""Implementação do ``VaultClient`` sobre a API KV v2 do HashiCorp Vault.

Usa ``httpx.AsyncClient`` em vez do ``hvac`` (síncrono) para não bloquear o
event loop. A superfície utilizada é pequena: ler, gravar, remover e health.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.vault.client import VaultClient
from app.vault.erros import VaultIndisponivelError, VaultPermissaoError

logger = logging.getLogger("app.vault")


class VaultHttpClient(VaultClient):
    def __init__(
        self,
        *,
        endereco: str,
        token: str,
        mount: str = "secret",
        prefixo: str = "oauth",
        timeout: float = 5.0,
        cliente_http: httpx.AsyncClient | None = None,
    ) -> None:
        self._endereco = endereco.rstrip("/")
        self._mount = mount.strip("/")
        self._prefixo = prefixo.strip("/")
        self._http = cliente_http or httpx.AsyncClient(
            base_url=self._endereco,
            timeout=timeout,
            headers={"X-Vault-Token": token},
        )

    # -- caminhos ---------------------------------------------------------

    def _caminho_completo(self, caminho: str) -> str:
        return f"{self._prefixo}/{caminho.strip('/')}"

    def _url_dados(self, caminho: str) -> str:
        return f"/v1/{self._mount}/data/{self._caminho_completo(caminho)}"

    def _url_metadados(self, caminho: str) -> str:
        return f"/v1/{self._mount}/metadata/{self._caminho_completo(caminho)}"

    # -- operações --------------------------------------------------------

    async def ler_segredo(self, caminho: str) -> dict[str, Any] | None:
        resposta = await self._requisitar("GET", self._url_dados(caminho))
        if resposta is None:
            return None
        return resposta.json().get("data", {}).get("data")

    async def gravar_segredo(self, caminho: str, dados: dict[str, Any]) -> None:
        await self._requisitar(
            "POST",
            self._url_dados(caminho),
            json={"data": dados},
            aceitar_404=False,
        )

    async def remover_segredo(self, caminho: str) -> None:
        await self._requisitar("DELETE", self._url_metadados(caminho))

    async def verificar_saude(self) -> bool:
        try:
            resposta = await self._http.get("/v1/sys/health")
        except httpx.HTTPError:
            logger.warning("Vault inacessível", exc_info=True)
            return False
        # 200 = destravado e ativo; 429 = standby, ainda utilizável para leitura.
        return resposta.status_code in (200, 429)

    async def fechar(self) -> None:
        await self._http.aclose()

    # -- infraestrutura ---------------------------------------------------

    async def _requisitar(
        self,
        metodo: str,
        url: str,
        *,
        json: dict[str, Any] | None = None,
        aceitar_404: bool = True,
    ) -> httpx.Response | None:
        try:
            resposta = await self._http.request(metodo, url, json=json)
        except httpx.HTTPError as erro:
            raise VaultIndisponivelError(f"Falha de comunicação com o Vault: {erro}") from erro

        if resposta.status_code == 404 and aceitar_404:
            return None
        if resposta.status_code in (401, 403):
            raise VaultPermissaoError("Token do Vault sem permissão sobre o caminho solicitado")
        if resposta.status_code >= 400:
            raise VaultIndisponivelError(
                f"Vault respondeu {resposta.status_code} para {metodo} {url}"
            )
        return resposta
