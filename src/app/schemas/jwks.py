"""Contrato do endpoint JWKS."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class JwksResposta(BaseModel):
    keys: list[dict[str, Any]] = Field(
        description=(
            "Chaves públicas em uso. Inclui a chave ativa e as em rotação, para que "
            "tokens assinados antes de uma rotação continuem validáveis até expirarem."
        )
    )
