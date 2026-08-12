"""Contratos do endpoint de healthcheck."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

StatusComponente = Literal["ok", "indisponivel"]


class SaudeResposta(BaseModel):
    status: Literal["ok", "degradado"] = Field(description="Situação geral do serviço")
    aplicacao: str
    versao: str
    ambiente: str
    componentes: dict[str, StatusComponente] = Field(
        default_factory=dict,
        description="Situação de cada dependência externa (banco de dados, Vault)",
    )
