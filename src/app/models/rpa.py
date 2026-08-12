"""Registro de uma RPA.

O cadastro e o status vivem aqui; as credenciais e a autorização do ``rpa_id``
ficam no Vault. As duas fontes precisam concordar para que um token seja emitido.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlmodel import Field, SQLModel

from app.models.base import agora_utc
from app.models.enums import StatusAcesso


class Rpa(SQLModel, table=True):
    __tablename__ = "rpas"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    rpa_id: str = Field(sa_type=String(120), unique=True, index=True)
    nome: str = Field(sa_type=String(150))
    descricao: str | None = Field(default=None, sa_type=String(500), nullable=True)
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
    revogado_em: datetime | None = Field(
        default=None, sa_type=DateTime(timezone=True), nullable=True
    )

    @property
    def pode_emitir_token(self) -> bool:
        return StatusAcesso(self.status).permite_emitir_token
