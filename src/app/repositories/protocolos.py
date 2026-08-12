"""Contratos dos repositórios.

Os services dependem destes protocolos e não das implementações SQL, o que
permite testá-los com fakes em memória, sem PostgreSQL.
"""

from __future__ import annotations

from typing import Protocol

from app.models.chave_jwt import ChaveJwt
from app.models.cliente import Cliente
from app.models.rpa import Rpa


class Repositorio(Protocol):
    async def confirmar(self) -> None:
        """Confirma a transação da sessão compartilhada pela requisição."""
        ...


class ClienteRepositorio(Repositorio, Protocol):
    async def buscar_por_client_id(self, client_id: str) -> Cliente | None: ...

    async def listar(self) -> list[Cliente]: ...

    async def salvar(self, cliente: Cliente) -> Cliente: ...


class RpaRepositorio(Repositorio, Protocol):
    async def buscar_por_rpa_id(self, rpa_id: str) -> Rpa | None: ...

    async def listar(self) -> list[Rpa]: ...

    async def salvar(self, rpa: Rpa) -> Rpa: ...


class ChaveJwtRepositorio(Repositorio, Protocol):
    async def buscar_ativa(self) -> ChaveJwt | None: ...

    async def buscar_por_kid(self, kid: str) -> ChaveJwt | None: ...

    async def listar_publicaveis(self) -> list[ChaveJwt]: ...

    async def salvar(self, chave: ChaveJwt) -> ChaveJwt: ...
