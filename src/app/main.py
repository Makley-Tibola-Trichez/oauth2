"""Ponto de entrada da aplicação FastAPI."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from scalar_fastapi import get_scalar_api_reference

from app import __version__
from app.config import obter_settings
from app.dependencies import obter_vault
from app.observability.logging import configurar_logging
from app.observability.middleware import MiddlewareRequestId
from app.routers import clientes, health, introspeccao, jwks, oauth_rpa, oauth_service, rpas
from app.security.key_manager import ChaveDeAssinaturaIndisponivelError
from app.services.erros import ErroDeNegocio, ErroOAuth
from app.vault.erros import VaultError

logger = logging.getLogger("app.main")

DESCRICAO = """
Serviço central de autenticação OAuth2 (Client Credentials) para RPAs e microsserviços internos.

**Como validar os tokens:** use a chave pública de `/.well-known/jwks.json` e valide localmente.
`POST /oauth/introspect` existe como mecanismo opcional de validação centralizada.
"""


@asynccontextmanager
async def ciclo_de_vida(app: FastAPI) -> AsyncIterator[None]:
    settings = obter_settings()
    logger.info(
        "Serviço iniciado",
        extra={
            "ambiente": settings.app_env,
            "versao": __version__,
            "modo_admin": settings.admin_auth_mode,
        },
    )
    yield
    await obter_vault().fechar()
    logger.info("Serviço finalizado")


def registrar_tratadores_de_erro(app: FastAPI) -> None:
    @app.exception_handler(ErroOAuth)
    async def _erro_oauth(_: Request, erro: ErroOAuth) -> JSONResponse:
        cabecalhos = (
            {"WWW-Authenticate": "Bearer"}
            if erro.status_code == status.HTTP_401_UNAUTHORIZED
            else None
        )
        return JSONResponse(
            status_code=erro.status_code,
            content={"error": erro.erro, "error_description": erro.descricao},
            headers=cabecalhos,
        )

    @app.exception_handler(ErroDeNegocio)
    async def _erro_negocio(_: Request, erro: ErroDeNegocio) -> JSONResponse:
        return JSONResponse(status_code=erro.status_code, content={"detail": erro.detalhe})

    @app.exception_handler(ChaveDeAssinaturaIndisponivelError)
    async def _sem_chave(_: Request, erro: ChaveDeAssinaturaIndisponivelError) -> JSONResponse:
        logger.error("Emissão de token indisponível", extra={"motivo": str(erro)})
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Serviço de assinatura indisponível"},
        )

    @app.exception_handler(VaultError)
    async def _erro_vault(_: Request, erro: VaultError) -> JSONResponse:
        logger.error("Falha ao consultar o Vault", extra={"motivo": str(erro)})
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"detail": "Cofre de segredos indisponível"},
        )


def criar_app() -> FastAPI:
    settings = obter_settings()
    configurar_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=DESCRICAO,
        lifespan=ciclo_de_vida,
        # Swagger UI e ReDoc ficam desabilitados; a documentação é servida pelo Scalar.
        docs_url=None,
        redoc_url=None,
        openapi_url="/openapi.json",
    )

    app.add_middleware(MiddlewareRequestId)
    registrar_tratadores_de_erro(app)

    app.include_router(health.router)
    app.include_router(jwks.router)
    app.include_router(oauth_rpa.router)
    app.include_router(oauth_service.router)
    app.include_router(introspeccao.router)
    app.include_router(clientes.router)
    app.include_router(rpas.router)

    @app.get("/scalar", include_in_schema=False)
    async def documentacao_scalar():  # pragma: no cover - only serves HTML
        return get_scalar_api_reference(
            openapi_url=app.openapi_url or "/openapi.json",
            title=f"{app.title} — documentação",
        )

    return app


app = criar_app()
