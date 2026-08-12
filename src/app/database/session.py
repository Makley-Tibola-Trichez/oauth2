"""Engine e sessões assíncronas do SQLAlchemy/SQLModel."""

from __future__ import annotations

from collections.abc import AsyncIterator
from functools import lru_cache

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from app.config import obter_settings


def criar_engine(url: str, *, echo: bool = False) -> AsyncEngine:
    return create_async_engine(url, echo=echo, pool_pre_ping=True, future=True)


@lru_cache(maxsize=1)
def obter_engine() -> AsyncEngine:
    return criar_engine(obter_settings().database_url)


@lru_cache(maxsize=1)
def obter_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(obter_engine(), class_=AsyncSession, expire_on_commit=False)


async def obter_sessao() -> AsyncIterator[AsyncSession]:
    """Dependência do FastAPI: entrega uma sessão e garante rollback/close.

    O commit é responsabilidade explícita dos services — há operações que
    precisam gravar no Vault antes de confirmar a transação.
    """
    async with obter_sessionmaker()() as sessao:
        try:
            yield sessao
        except Exception:
            await sessao.rollback()
            raise
