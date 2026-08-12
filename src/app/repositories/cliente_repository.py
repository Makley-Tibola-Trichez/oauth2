"""Acesso ao PostgreSQL para clientes OAuth2."""

from __future__ import annotations

from sqlmodel import select

from app.models.cliente import Cliente
from app.repositories.base import RepositorioSQL


class ClienteRepositorioSQL(RepositorioSQL):
    async def buscar_por_client_id(self, client_id: str) -> Cliente | None:
        resultado = await self.sessao.exec(select(Cliente).where(Cliente.client_id == client_id))
        return resultado.first()

    async def listar(self) -> list[Cliente]:
        resultado = await self.sessao.exec(select(Cliente).order_by(Cliente.criado_em))
        return list(resultado.all())

    async def salvar(self, cliente: Cliente) -> Cliente:
        return await self._persistir(cliente)
