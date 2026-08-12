"""Acesso ao PostgreSQL para os metadados das chaves JWT."""

from __future__ import annotations

from sqlmodel import col, select

from app.models.chave_jwt import ChaveJwt
from app.models.enums import StatusChave
from app.repositories.base import RepositorioSQL

STATUS_PUBLICAVEIS = (StatusChave.ATIVA, StatusChave.EM_ROTACAO)


class ChaveJwtRepositorioSQL(RepositorioSQL):
    async def buscar_ativa(self) -> ChaveJwt | None:
        resultado = await self.sessao.exec(
            select(ChaveJwt).where(ChaveJwt.status == StatusChave.ATIVA)
        )
        return resultado.first()

    async def buscar_por_kid(self, kid: str) -> ChaveJwt | None:
        return await self.sessao.get(ChaveJwt, kid)

    async def listar_publicaveis(self) -> list[ChaveJwt]:
        """Chaves que devem aparecer no JWKS: a ativa e as ainda em rotação."""
        resultado = await self.sessao.exec(
            select(ChaveJwt)
            .where(col(ChaveJwt.status).in_(STATUS_PUBLICAVEIS))
            .order_by(col(ChaveJwt.criado_em).desc())
        )
        return list(resultado.all())

    async def listar_em_rotacao(self) -> list[ChaveJwt]:
        resultado = await self.sessao.exec(
            select(ChaveJwt).where(ChaveJwt.status == StatusChave.EM_ROTACAO)
        )
        return list(resultado.all())

    async def salvar(self, chave: ChaveJwt) -> ChaveJwt:
        return await self._persistir(chave)
