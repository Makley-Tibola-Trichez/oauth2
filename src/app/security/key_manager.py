"""Gerenciamento do ciclo de vida das chaves de assinatura.

Duas fontes, com papéis distintos:

- **PostgreSQL** (``chaves_jwt``): ``kid``, chave pública e status. É daqui que
  sai o JWKS, então o endpoint público não depende do Vault.
- **Vault** (``jwt/keys/{kid}``): a chave privada, e nada além dela.

A rotação grava no Vault **antes** de tocar no banco; o commit fica com quem
chamou, de modo que a troca de chave ativa acontece em uma única transação.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from app.models.base import agora_utc
from app.models.chave_jwt import ChaveJwt
from app.models.enums import StatusChave
from app.observability import auditoria
from app.repositories.protocolos import ChaveJwtRepositorio
from app.security.chaves import ALGORITMO_PADRAO, chave_publica_para_jwk, gerar_par_de_chaves
from app.vault.caminhos import caminho_chave_privada
from app.vault.client import VaultClient

logger = logging.getLogger("app.chaves")

TTL_CACHE_SEGUNDOS = 300


class ChaveDeAssinaturaIndisponivelError(RuntimeError):
    """Não há chave ativa no banco ou a privada sumiu do Vault."""


@dataclass(frozen=True, slots=True)
class ChaveDeAssinatura:
    kid: str
    algoritmo: str
    chave_privada_pem: str


class CacheChavesPrivadas:
    """Cache em memória com TTL curto, para não ir ao Vault a cada token."""

    def __init__(self, ttl_segundos: int = TTL_CACHE_SEGUNDOS) -> None:
        self._ttl = ttl_segundos
        self._itens: dict[str, tuple[str, float]] = {}

    def obter(self, kid: str) -> str | None:
        item = self._itens.get(kid)
        if item is None:
            return None
        valor, expira_em = item
        if time.monotonic() >= expira_em:
            self._itens.pop(kid, None)
            return None
        return valor

    def guardar(self, kid: str, chave_privada_pem: str) -> None:
        self._itens[kid] = (chave_privada_pem, time.monotonic() + self._ttl)

    def invalidar(self, kid: str | None = None) -> None:
        if kid is None:
            self._itens.clear()
        else:
            self._itens.pop(kid, None)


# Compartilhado entre requisições: as instâncias do gerenciador são efêmeras.
cache_chaves_privadas = CacheChavesPrivadas()


class GerenciadorChaves:
    def __init__(
        self,
        chave_repositorio: ChaveJwtRepositorio,
        vault: VaultClient,
        *,
        minutos_de_graca: int = 35,
        cache: CacheChavesPrivadas | None = None,
    ) -> None:
        self._repositorio = chave_repositorio
        self._vault = vault
        self._minutos_de_graca = minutos_de_graca
        self._cache = cache if cache is not None else cache_chaves_privadas

    # -- assinatura -------------------------------------------------------

    async def obter_chave_de_assinatura(self) -> ChaveDeAssinatura:
        chave = await self._repositorio.buscar_ativa()
        if chave is None:
            raise ChaveDeAssinaturaIndisponivelError(
                "Nenhuma chave JWT ativa cadastrada; execute o bootstrap ou a rotação"
            )

        privada = self._cache.obter(chave.kid)
        if privada is None:
            segredo = await self._vault.ler_segredo(caminho_chave_privada(chave.kid))
            if not segredo or not segredo.get("chave_privada_pem"):
                raise ChaveDeAssinaturaIndisponivelError(
                    f"Chave privada do kid {chave.kid} não encontrada no Vault"
                )
            privada = str(segredo["chave_privada_pem"])
            self._cache.guardar(chave.kid, privada)

        return ChaveDeAssinatura(
            kid=chave.kid,
            algoritmo=chave.algoritmo,
            chave_privada_pem=privada,
        )

    # -- validação / publicação ------------------------------------------

    async def obter_chave_publica(self, kid: str) -> str | None:
        """Chave pública de um ``kid``, para validar tokens (inclusive antigos)."""
        chave = await self._repositorio.buscar_por_kid(kid)
        if chave is None or not StatusChave(chave.status).publicavel_no_jwks:
            return None
        return chave.chave_publica_pem

    async def obter_jwks(self) -> dict[str, list[dict[str, Any]]]:
        """JWKS montado apenas com o PostgreSQL — não depende do Vault."""
        chaves = await self._repositorio.listar_publicaveis()
        return {
            "keys": [
                chave_publica_para_jwk(chave.chave_publica_pem, chave.kid, chave.algoritmo)
                for chave in chaves
            ]
        }

    # -- ciclo de vida ----------------------------------------------------

    async def garantir_chave_ativa(self) -> ChaveJwt:
        """Cria a primeira chave se ainda não houver nenhuma ativa (bootstrap)."""
        existente = await self._repositorio.buscar_ativa()
        if existente is not None:
            return existente
        return await self.rotacionar()

    async def rotacionar(self) -> ChaveJwt:
        """Gera uma nova chave ativa e coloca a anterior em rotação.

        A chave privada vai para o Vault antes de qualquer escrita no banco: se
        a transação não for confirmada, sobra apenas um segredo órfão, sem
        ``kid`` publicado — inofensivo. O commit é responsabilidade de quem chama.
        """
        par = gerar_par_de_chaves()
        await self._vault.gravar_segredo(
            caminho_chave_privada(par.kid),
            {"chave_privada_pem": par.chave_privada_pem},
        )

        anterior = await self._repositorio.buscar_ativa()
        if anterior is not None:
            anterior.status = StatusChave.EM_ROTACAO
            anterior.expira_em = agora_utc() + timedelta(minutes=self._minutos_de_graca)
            await self._repositorio.salvar(anterior)

        nova = ChaveJwt(
            kid=par.kid,
            chave_publica_pem=par.chave_publica_pem,
            algoritmo=par.algoritmo or ALGORITMO_PADRAO,
            status=StatusChave.ATIVA,
        )
        await self._repositorio.salvar(nova)
        self._cache.guardar(par.kid, par.chave_privada_pem)

        auditoria.registrar(
            auditoria.CHAVE_ROTACIONADA,
            "Nova chave de assinatura ativa",
            kid=nova.kid,
            kid_anterior=anterior.kid if anterior else None,
        )
        return nova

    async def aposentar_chaves_expiradas(self) -> list[str]:
        """Tira do JWKS as chaves em rotação cujo período de graça acabou."""
        aposentadas: list[str] = []
        agora = agora_utc()

        for chave in await self._repositorio.listar_publicaveis():
            if StatusChave(chave.status) is not StatusChave.EM_ROTACAO:
                continue
            if chave.expira_em is None or chave.expira_em > agora:
                continue

            chave.status = StatusChave.APOSENTADA
            await self._repositorio.salvar(chave)
            await self._vault.remover_segredo(caminho_chave_privada(chave.kid))
            self._cache.invalidar(chave.kid)
            aposentadas.append(chave.kid)

        if aposentadas:
            auditoria.registrar(
                auditoria.CHAVE_ROTACIONADA,
                "Chaves aposentadas após o período de graça",
                kids=aposentadas,
            )
        return aposentadas
