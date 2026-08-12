"""Healthcheck público do serviço."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app import __version__
from app.config import obter_settings
from app.database import obter_sessao
from app.schemas.saude import SaudeResposta, StatusComponente

logger = logging.getLogger("app.health")

router = APIRouter(tags=["Infraestrutura"])


async def _verificar_banco(sessao: AsyncSession) -> StatusComponente:
    try:
        await sessao.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Banco de dados indisponível", exc_info=True)
        return "indisponivel"
    return "ok"


@router.get("/health", response_model=SaudeResposta, summary="Verifica a saúde do serviço")
async def health(sessao: Annotated[AsyncSession, Depends(obter_sessao)]) -> SaudeResposta:
    settings = obter_settings()
    componentes: dict[str, StatusComponente] = {"banco_de_dados": await _verificar_banco(sessao)}

    return SaudeResposta(
        status="ok" if all(v == "ok" for v in componentes.values()) else "degradado",
        aplicacao=settings.app_name,
        versao=__version__,
        ambiente=settings.app_env,
        componentes=componentes,
    )
