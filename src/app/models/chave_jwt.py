"""Metadados das chaves de assinatura JWT.

Aqui fica apenas material **público**: ``kid``, chave pública e ciclo de vida.
A chave privada correspondente vive exclusivamente no Vault, em
``{mount}/{base}/jwt/keys/{kid}``.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Index, String, text
from sqlmodel import Field, SQLModel

from app.models.base import agora_utc
from app.models.enums import StatusChave


class ChaveJwt(SQLModel, table=True):
    __tablename__ = "chaves_jwt"
    __table_args__ = (
        # Garante, no banco, que existe no máximo uma chave assinando por vez.
        Index(
            "ix_chaves_jwt_unica_ativa",
            "status",
            unique=True,
            postgresql_where=text("status = 'ativa'"),
        ),
    )

    kid: str = Field(sa_type=String(64), primary_key=True)
    chave_publica_pem: str = Field(sa_type=String(4096))
    algoritmo: str = Field(default="RS256", sa_type=String(20))
    status: StatusChave = Field(default=StatusChave.ATIVA, sa_type=String(20), index=True)

    criado_em: datetime = Field(
        default_factory=agora_utc, sa_type=DateTime(timezone=True), nullable=False
    )
    # Momento a partir do qual a chave em rotação pode ser aposentada com segurança.
    expira_em: datetime | None = Field(default=None, sa_type=DateTime(timezone=True), nullable=True)
