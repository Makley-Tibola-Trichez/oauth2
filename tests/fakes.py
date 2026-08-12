"""Repositórios em memória, para testar services sem PostgreSQL."""

from __future__ import annotations

from app.models.chave_jwt import ChaveJwt
from app.models.cliente import Cliente
from app.models.enums import StatusChave
from app.models.rpa import Rpa


class _FakeRepositorio:
    def __init__(self) -> None:
        self.confirmacoes = 0

    async def confirmar(self) -> None:
        self.confirmacoes += 1


class FakeClienteRepositorio(_FakeRepositorio):
    def __init__(self, clientes: list[Cliente] | None = None) -> None:
        super().__init__()
        self.itens: dict[str, Cliente] = {c.client_id: c for c in clientes or []}

    async def buscar_por_client_id(self, client_id: str) -> Cliente | None:
        return self.itens.get(client_id)

    async def listar(self) -> list[Cliente]:
        return list(self.itens.values())

    async def salvar(self, cliente: Cliente) -> Cliente:
        self.itens[cliente.client_id] = cliente
        return cliente


class FakeRpaRepositorio(_FakeRepositorio):
    def __init__(self, rpas: list[Rpa] | None = None) -> None:
        super().__init__()
        self.itens: dict[str, Rpa] = {r.rpa_id: r for r in rpas or []}

    async def buscar_por_rpa_id(self, rpa_id: str) -> Rpa | None:
        return self.itens.get(rpa_id)

    async def listar(self) -> list[Rpa]:
        return list(self.itens.values())

    async def salvar(self, rpa: Rpa) -> Rpa:
        self.itens[rpa.rpa_id] = rpa
        return rpa


class FakeChaveJwtRepositorio(_FakeRepositorio):
    def __init__(self, chaves: list[ChaveJwt] | None = None) -> None:
        super().__init__()
        self.itens: dict[str, ChaveJwt] = {c.kid: c for c in chaves or []}

    async def buscar_ativa(self) -> ChaveJwt | None:
        return next(
            (c for c in self.itens.values() if StatusChave(c.status) is StatusChave.ATIVA),
            None,
        )

    async def buscar_por_kid(self, kid: str) -> ChaveJwt | None:
        return self.itens.get(kid)

    async def listar_publicaveis(self) -> list[ChaveJwt]:
        return [c for c in self.itens.values() if StatusChave(c.status).publicavel_no_jwks]

    async def salvar(self, chave: ChaveJwt) -> ChaveJwt:
        self.itens[chave.kid] = chave
        return chave
