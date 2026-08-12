"""Healthcheck público do serviço."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.config import obter_settings
from app.schemas.saude import SaudeResposta

router = APIRouter(tags=["Infraestrutura"])


@router.get("/health", response_model=SaudeResposta, summary="Verifica a saúde do serviço")
async def health() -> SaudeResposta:
    settings = obter_settings()
    return SaudeResposta(
        status="ok",
        aplicacao=settings.app_name,
        versao=__version__,
        ambiente=settings.app_env,
        componentes={},
    )
