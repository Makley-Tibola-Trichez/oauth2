"""Contratos do endpoint de introspection (RFC 7662)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class IntrospeccaoForm(BaseModel):
    token: str = Field(description="Access token a inspecionar")


class IntrospeccaoResposta(BaseModel):
    """Resposta da RFC 7662. Token inválido ou expirado devolve apenas ``active: false``."""

    active: bool
    sub: str | None = None
    tipo: str | None = None
    rpa_id: str | None = None
    client_id: str | None = None
    iss: str | None = None
    aud: str | None = None
    iat: int | None = None
    exp: int | None = None
    jti: str | None = None
    token_type: str | None = None
