"""Base comum dos repositórios SQL."""

from __future__ import annotations

from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession


class RepositorioSQL:
    """Encapsula a sessão. O commit fica com o service, que coordena a transação."""

    def __init__(self, sessao: AsyncSession) -> None:
        self.sessao = sessao

    async def _persistir[T: SQLModel](self, entidade: T) -> T:
        self.sessao.add(entidade)
        await self.sessao.flush()
        await self.sessao.refresh(entidade)
        return entidade
