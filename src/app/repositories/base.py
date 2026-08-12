"""Base comum dos repositórios SQL."""

from __future__ import annotations

from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession


class RepositorioSQL:
    """Encapsula a sessão. O service coordena a transação chamando ``confirmar``."""

    def __init__(self, sessao: AsyncSession) -> None:
        self.sessao = sessao

    async def confirmar(self) -> None:
        """Confirma a transação em curso.

        Como todos os repositórios de uma requisição compartilham a mesma
        sessão, um único ``confirmar`` fecha as escritas de todos eles.
        """
        await self.sessao.commit()

    async def _persistir[T: SQLModel](self, entidade: T) -> T:
        self.sessao.add(entidade)
        await self.sessao.flush()
        await self.sessao.refresh(entidade)
        return entidade
