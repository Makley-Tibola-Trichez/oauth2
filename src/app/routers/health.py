"""Healthcheck público do serviço."""

from __future__ import annotations

import logging

from fastapi import APIRouter
from sqlalchemy import text
from sqlmodel.ext.asyncio.session import AsyncSession

from app import __version__
from app.config import obter_settings
from app.dependencies import SessaoDep, VaultDep
from app.schemas.saude import SaudeResposta, StatusComponente
from app.vault.client import VaultClient

logger = logging.getLogger("app.health")

router = APIRouter(tags=["Infraestrutura"])


async def _verificar_banco(sessao: AsyncSession) -> StatusComponente:
    try:
        await sessao.execute(text("SELECT 1"))
    except Exception:
        logger.warning("Banco de dados indisponível", exc_info=True)
        return "indisponivel"
    return "ok"


async def _verificar_vault(vault: VaultClient) -> StatusComponente:
    try:
        return "ok" if await vault.verificar_saude() else "indisponivel"
    except Exception:
        logger.warning("Vault indisponível", exc_info=True)
        return "indisponivel"


@router.get("/health", response_model=SaudeResposta, summary="Verifica a saúde do serviço")
async def health(sessao: SessaoDep, vault: VaultDep) -> SaudeResposta:
    settings = obter_settings()
    componentes: dict[str, StatusComponente] = {
        "banco_de_dados": await _verificar_banco(sessao),
        "vault": await _verificar_vault(vault),
    }

    return SaudeResposta(
        status="ok" if all(valor == "ok" for valor in componentes.values()) else "degradado",
        aplicacao=settings.app_name,
        versao=__version__,
        ambiente=settings.app_env,
        componentes=componentes,
    )
