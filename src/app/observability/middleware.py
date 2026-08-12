"""Middleware que correlaciona logs por requisição."""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.observability.contexto import definir_request_id, limpar_request_id

logger = logging.getLogger("app.requisicao")

CABECALHO_REQUEST_ID = "X-Request-ID"


class MiddlewareRequestId(BaseHTTPMiddleware):
    """Propaga (ou gera) o ``X-Request-ID`` e registra o desfecho da requisição."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        request_id = definir_request_id(request.headers.get(CABECALHO_REQUEST_ID))
        inicio = time.perf_counter()
        try:
            resposta = await call_next(request)
        except Exception:
            logger.exception(
                "Erro não tratado na requisição",
                extra={
                    "metodo": request.method,
                    "rota": request.url.path,
                    "duracao_ms": round((time.perf_counter() - inicio) * 1000, 2),
                },
            )
            limpar_request_id()
            raise

        logger.info(
            "Requisição concluída",
            extra={
                "metodo": request.method,
                "rota": request.url.path,
                "status": resposta.status_code,
                "duracao_ms": round((time.perf_counter() - inicio) * 1000, 2),
            },
        )
        resposta.headers[CABECALHO_REQUEST_ID] = request_id
        limpar_request_id()
        return resposta
