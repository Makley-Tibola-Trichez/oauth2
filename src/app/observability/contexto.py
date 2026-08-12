"""Contexto de requisição propagado para os logs sem passar por assinatura de função."""

from __future__ import annotations

import uuid
from contextvars import ContextVar

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def definir_request_id(valor: str | None = None) -> str:
    """Define o identificador da requisição atual, gerando um se não vier do cliente."""
    request_id = valor or uuid.uuid4().hex
    _request_id.set(request_id)
    return request_id


def obter_request_id() -> str | None:
    return _request_id.get()


def limpar_request_id() -> None:
    _request_id.set(None)
