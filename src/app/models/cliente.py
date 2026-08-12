"""Cliente OAuth2 (microsserviço ou aplicação de RPA)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlmodel import Field, SQLModel

from app.models.base import agora_utc
from app.models.enums import StatusAcesso, TipoCliente


class Cliente(SQLModel, table=True):
    """Credencial OAuth2. O ``client_secret`` só existe aqui em forma de hash."""

    __tablename__ = "clientes"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client_id: str = Field(sa_type=String(120), unique=True, index=True)
    client_secret_hash: str = Field(sa_type=String(255))
    nome: str = Field(sa_type=String(150))
    descricao: str | None = Field(default=None, sa_type=String(500), nullable=True)
    tipo: TipoCliente = Field(sa_type=String(20), index=True)
    status: StatusAcesso = Field(default=StatusAcesso.ATIVO, sa_type=String(20), index=True)

    criado_em: datetime = Field(
        default_factory=agora_utc, sa_type=DateTime(timezone=True), nullable=False
    )
    atualizado_em: datetime = Field(
        default_factory=agora_utc,
        sa_type=DateTime(timezone=True),
        nullable=False,
        sa_column_kwargs={"onupdate": agora_utc},
    )
    secret_rotacionado_em: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True), nullable=True
    )
    revogado_em: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True), nullable=True
    )

    @property
    def pode_emitir_token(self) -> bool:
        return StatusAcesso(self.status).permite_emitir_token
