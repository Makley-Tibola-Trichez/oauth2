"""Logging estruturado em JSON para stdout, pronto para coleta pelo Grafana Loki.

Nada de segredo pode sair daqui: o ``FiltroRedacao`` percorre os campos extras de
cada registro e substitui por ``***`` qualquer chave sensível, inclusive dentro de
dicionários e listas aninhadas.
"""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from typing import Any

from app.observability.contexto import obter_request_id

VALOR_REDIGIDO = "***"

# Trechos que, se aparecerem no nome de um campo, tornam o valor sensível.
TRECHOS_SENSIVEIS: frozenset[str] = frozenset(
    {
        "secret",
        "token",
        "password",
        "senha",
        "private",
        "privada",
        "credencial",
        "credenciais",
        "credential",
        "authorization",
        "api_key",
        "apikey",
        "chave_privada",
    }
)

# Campos cujo nome casa com os trechos acima mas que não carregam segredo algum.
CAMPOS_LIBERADOS: frozenset[str] = frozenset({"token_type", "grant_type", "tipo_token"})

# Atributos que o próprio logging coloca no LogRecord; tudo além disso é campo extra.
_ATRIBUTOS_PADRAO: frozenset[str] = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)


def campo_e_sensivel(nome: str) -> bool:
    nome_normalizado = nome.lower()
    if nome_normalizado in CAMPOS_LIBERADOS:
        return False
    return any(trecho in nome_normalizado for trecho in TRECHOS_SENSIVEIS)


def redigir(valor: Any) -> Any:
    """Retorna uma cópia do valor com todos os campos sensíveis substituídos."""
    if isinstance(valor, dict):
        return {
            chave: VALOR_REDIGIDO if campo_e_sensivel(str(chave)) else redigir(item)
            for chave, item in valor.items()
        }
    if isinstance(valor, list | tuple | set):
        return [redigir(item) for item in valor]
    return valor


class FiltroRedacao(logging.Filter):
    """Remove segredos dos campos extras antes que qualquer handler os escreva."""

    def filter(self, record: logging.LogRecord) -> bool:
        for chave, valor in list(record.__dict__.items()):
            if chave in _ATRIBUTOS_PADRAO or chave.startswith("_"):
                continue
            if campo_e_sensivel(chave):
                record.__dict__[chave] = VALOR_REDIGIDO
            else:
                record.__dict__[chave] = redigir(valor)
        return True


class FormatadorJson(logging.Formatter):
    """Serializa o registro como uma única linha JSON."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "nivel": record.levelname,
            "logger": record.name,
            "mensagem": record.getMessage(),
        }

        request_id = obter_request_id()
        if request_id:
            payload["request_id"] = request_id

        for chave, valor in record.__dict__.items():
            if chave in _ATRIBUTOS_PADRAO or chave.startswith("_"):
                continue
            payload[chave] = valor

        if record.exc_info:
            payload["excecao"] = self.formatException(record.exc_info)
        if record.stack_info:
            payload["stack"] = self.formatStack(record.stack_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


def configurar_logging(nivel: str = "INFO") -> None:
    """Instala o handler JSON em stdout como única saída de log da aplicação."""
    # Garante UTF-8 mesmo em consoles Windows, que por padrão usam a codepage local.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(FormatadorJson())
    handler.addFilter(FiltroRedacao())

    raiz = logging.getLogger()
    for existente in list(raiz.handlers):
        raiz.removeHandler(existente)
    raiz.addHandler(handler)
    raiz.setLevel(nivel.upper())

    # Faz o uvicorn escrever pelo mesmo handler, mantendo tudo em JSON.
    for nome in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger_uvicorn = logging.getLogger(nome)
        logger_uvicorn.handlers.clear()
        logger_uvicorn.propagate = True
