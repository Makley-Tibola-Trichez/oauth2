"""Ponto de entrada da aplicação FastAPI."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import __version__
from app.config import obter_settings
from app.dependencies import obter_vault
from app.observability.logging import configurar_logging
from app.observability.middleware import MiddlewareRequestId
from app.routers import health

logger = logging.getLogger("app.main")


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI) -> AsyncIterator[None]:
    settings = obter_settings()
    logger.info(
        "Serviço iniciado",
        extra={"ambiente": settings.app_env, "versao": __version__},
    )
    yield
    await obter_vault().fechar()
    logger.info("Serviço finalizado")


def criar_app() -> FastAPI:
    settings = obter_settings()
    configurar_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Serviço central de autenticação OAuth2 (Client Credentials) para RPAs e "
            "microsserviços internos."
        ),
        lifespan=ciclo_de_vida,
        # Swagger UI e ReDoc ficam desabilitados; a documentação é servida pelo Scalar.
        docs_url=None,
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.add_middleware(MiddlewareRequestId)
    app.include_router(health.router)

    return app


app = criar_app()
