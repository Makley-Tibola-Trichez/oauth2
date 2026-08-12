"""Contratos dos endpoints de gestão de RPAs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import StatusAcesso
from app.schemas.cliente import PADRAO_IDENTIFICADOR


class RpaCriacaoRequest(BaseModel):
    rpa_id: str = Field(pattern=PADRAO_IDENTIFICADOR, examples=["rpa_custeio"])
    nome: str = Field(min_length=3, max_length=150, examples=["RPA de Custeio"])
    descricao: str | None = Field(default=None, max_length=500)
    credenciais: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Credenciais que a RPA consome (usuário de sistema, chave de API...). "
            "São gravadas exclusivamente no Vault, nunca no banco."
        ),
        examples=[{"usuario": "rpa.custeio", "senha": "***"}],
    )


class RpaResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rpa_id: str
    nome: str
    descricao: str | None
    status: StatusAcesso
    criado_em: datetime
    atualizado_em: datetime
    revogado_em: datetime | None


class CredenciaisRpaResposta(BaseModel):
    rpa_id: str
    credenciais: dict[str, Any]
