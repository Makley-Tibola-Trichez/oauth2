"""Acesso ao PostgreSQL para o cadastro de RPAs."""

from __future__ import annotations

from sqlmodel import select

from app.models.rpa import Rpa
from app.repositories.base import RepositorioSQL


class RpaRepositorioSQL(RepositorioSQL):
    async def buscar_por_rpa_id(self, rpa_id: str) -> Rpa | None:
        resultado = await self.sessao.exec(select(Rpa).where(Rpa.rpa_id == rpa_id))
        return resultado.first()

    async def listar(self) -> list[Rpa]:
        resultado = await self.sessao.exec(select(Rpa).order_by(Rpa.criado_em))
        return list(resultado.all())

    async def salvar(self, rpa: Rpa) -> Rpa:
        return await self._persistir(rpa)
